import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntryType } from '@prisma/client';
import { AgentsService } from '../../../../agents/agents.service';
import { EntriesService } from '../../../entries.service';
import { ClientRequestEvent } from '../../../events/client-request.event';

@Injectable()
export class WebpageService {
  constructor(
    @Inject('AgentsService')
    private readonly agentsService: AgentsService,
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate webpage[view/route/model/view-model], then respond the src code
   * FIXME: progressive generation
   */
  @Transactional()
  async genWebpages(
    data: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    data.stopPropagation = true; // stop event propagation

    // data.context.callgent
    // data.context.req: { requirement }
    // data.context.endpoints, target events,

    // callgent default rest c-entry as base url
    const cen = await this.entriesService.findFirstByType(
      EntryType.CLIENT,
      data.context.callgent.id,
      'restAPI',
    );
    if (!cen?.host)
      throw new Error(
        'There must be a restAPI client entry as backend API for callgent#' +
          data.context.callgent.id,
      );
    const apiBaseUrl = `${this.configService.get('SITE_ROOT_URL')}${cen.host}`;

    const files: { [filePath: string]: string } = {};

    // generate route
    const agentData: any = {
      srcId: data.srcId,
      callgent: data.context.callgent,
      requirement: data.context.req.requirement,
    };
    // 1. generate `router/index.js`, only necessary `views` for the requirement
    const route = await this.agentsService.genVue1Route(agentData);
    files['/src/routes/index.js'] = route['/src/router/index.js'];
    // delete route['router/index.js'];
    // data.context.webpages.route = route;

    // 2. define necessary Vue `components`, associate with each `view`: {view: [comps]};
    agentData.views = route.views;
    const comps = await this.agentsService.genVue2Components(agentData);
    const compViews: { [compName: string]: string[] } = {};
    Object.entries(comps.associations).forEach(([viewName, comps]) =>
      comps?.forEach((compName) => {
        const views = compViews[compName] || (compViews[compName] = []);
        views.push(viewName);
      }),
    );

    // 3. choose needed service endpoints for each component: {comp: [apis]};
    // TODO filter by view distances
    const compsList = Object.entries(comps.components).map(([name, comp]) => ({
      ...comp,
      name,
    }));
    const endpoints = data.context.endpoints.map((e) => {
      const params = e.params?.parameters?.map((p) => p.name) || [];
      e.params.requestBody?.content &&
        params.push(
          (Object.values(e.params.requestBody.content)[0] as any).schema,
        );
      return { ...e, params };
    });
    const compApis = await this.agentsService.genVue3Apis({
      endpoints,
      compsList,
      srcId: data.srcId,
      callgent: data.context.callgent,
    });

    // 4. generate `components/*.vue` code, which may import `stores/*.js`;
    const stores: {
      file: string;
      state: object;
      actions: string[];
      getters: string[];
      endpoints: string[];
    }[] = [];
    let packages: string[] = [
      'vue@3.5.12',
      'vue-router@4.4.5',
      'element-plus@2.8.6',
      'vee-validate@4.14.6',
      'yup@1.4.0',
    ];
    const entries = Object.entries(compApis);
    for (const [compName, comp] of entries) {
      // endpoints for the component
      const endpoints = comp.endpoints.map((epName) => {
        const ep = data.context.endpoints.find((ep) => ep.name === epName);
        return { name: ep.name, params: ep.params, responses: ep.responses };
      });
      // list related views
      const relatedViews = compViews[compName].map((view) => ({
        name: view,
        url: route.views[view].url,
        title: route.views[view].title,
        summary: route.views[view].summary,
        instruction: route.views[view].instruction,
        components: comps.associations[view].filter((c) => c in compApis),
      }));
      const otherViews = Object.entries(route.views)
        .filter(([name, v]) => !relatedViews.find((v0) => v0.name === name))
        .map(([name, v]) => ({ name, url: v.url, summary: v.summary }));

      // and comps related to the views
      const components: {
        name: string;
        file?: string;
        summary: string;
        instruction?: string;
        endpoints?: { name: string; params: object; responses: object }[];
      }[] = relatedViews
        .map((v) => comps.associations[v.name])
        .flat()
        .filter((c) => c !== compName && c in compApis)
        .map((c) => ({ name: c, summary: compApis[c].summary }));
      components.unshift({
        name: compName,
        file: comps.components[compName].file,
        ...comp,
        endpoints,
      });

      const component = await this.agentsService.genVue4Components({
        components,
        relatedViews,
        otherViews,
        stores,
        packages,
        srcId: data.srcId,
      });
      files[components[0].file] = component.code;

      // merge packages
      component.packages?.length &&
        (packages = [...new Set([...packages, ...component.packages])]);
      // merge stores
      component.importedStores?.forEach((store) => {
        const s = stores.find((s) => s.file === store.file);
        if (s) {
          store.actions?.length &&
            (s.actions = [...new Set([...s.actions, ...store.actions])]);
          store.getters?.length &&
            (s.getters = [...new Set([...s.getters, ...store.getters])]);
          comp.endpoints?.length &&
            (s.endpoints = [...new Set([...s.endpoints, ...comp.endpoints])]);

          // deep merge state
          if (store.state) this._deepMerge(s.state, store.state);
        } else {
          (store as any).endpoints = comp.endpoints || [];
          store.state || (store.state = {});
          store.actions || (store.actions = []);
          store.getters || (store.getters = []);
          stores.push(store as any);
        }
      });
    }

    // 5. generate `stores/*.js` used by components, bind `actions` to service endpoints.
    packages.push('pinia@2.2.4', 'axios@1.7.7');
    for (const store of stores) {
      const endpoints = store.endpoints.map((epName) => {
        const ep = data.context.endpoints.find((ep) => ep.name === epName);
        return {
          name: ep.name,
          summary: ep.summary,
          description: ep.description,
          params: ep.params,
          responses: ep.responses,
        };
      });

      const storeResult = await this.agentsService.genVue5Stores({
        packages,
        store: { ...store, endpoints },
        apiBaseUrl,
        srcId: data.srcId,
      });
      // merge packages
      storeResult.packages?.length &&
        (packages = [...new Set([...packages, ...storeResult.packages])]);
      files[store.file] = storeResult.code;
    }

    // 6. generate `views/*.vue` code, which imports `components/*.js`, and `stores/*.js` if really needed.
    // change view descriptions

    // 7. generate App.vue, main.js

    return { data };
  }

  private _deepMerge(target: object, source: object) {
    if (typeof source !== 'object') return;

    Object.entries(source).forEach(([key, val]) => {
      if (!val) return;
      if (target[key]) {
        if (typeof val === 'object') {
          if (Array.isArray(val)) {
            if (val.length) {
              if (target[key]?.length) {
                if (typeof target[key][0] !== 'object')
                  target[key][0] = val[0]; // type conflict
                else if (typeof val[0] !== 'object')
                  throw new Error(
                    `type conflict, cannot merge, src: ${JSON.stringify(val[0])}, target: ${JSON.stringify(target[key][0])}`,
                  );
                else this._deepMerge(target[key][0], val[0]);
              } else target[key] = val;
            }
          } else if (typeof target[key] !== 'object')
            target[key] = val; // type conflict
          else this._deepMerge(target[key], val);
        } else target[key] = val;
      } else target[key] = val;
    });
  }
}

import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntryType } from '@prisma/client';
import { AgentsService } from '../../../../agents/agents.service';
import { EntriesService } from '../../../entries.service';
import { ClientRequestEvent } from '../../../events/client-request.event';
import { RoutesMapper } from '@nestjs/core/middleware/routes-mapper';

@Injectable()
export class WebpageService {
  constructor(
    @Inject('AgentsService')
    private readonly agentsService: AgentsService,
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
    private readonly configService: ConfigService,
  ) {
    this.initPackagesComponent = JSON.parse(
      this.configService.get('WEBPAGE_PACKAGES_COMPONENT'),
    );
    this.initPackagesStore = JSON.parse(
      this.configService.get('WEBPAGE_PACKAGES_STORE'),
    );
  }
  private readonly logger = new Logger(WebpageService.name);
  protected initPackagesComponent = [];
  protected initPackagesStore = [];

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
    // 1. generate `router/index.js`, only necessary `views` for the requirement
    const viewList = await this.agentsService.genVue1Route({
      event: data,
      callgent: data.context.callgent,
      requirement: data.context.req.requirement,
    });
    const viewMap: { [name: string]: any } = viewList.reduce(
      (acc, view) => ((acc[view.name] = view), acc),
      {},
    );
    // files['/src/routes/index.js'] = route['/src/router/index.js'];
    // delete route['router/index.js'];
    // const viewList = Object.entries(route.views).map(([name, view]) => ({
    //   name,
    //   ...view,
    // }));

    // 2. define necessary Vue `components`, associate with each `view`: {view: [comps]};
    const components: {
      [comName: string]: {
        file: string;
        // props: string[];
        summary: string;
        instruction: string;
        endpoints: string[];
        inViews: string[];
        spec?: object;
      };
    } = {};
    const endpoints = data.context.endpoints.map((e) => {
      const params = e.params?.parameters?.map((p) => p.name) || [];
      e.params.requestBody?.content &&
        params.push(
          (Object.values(e.params.requestBody.content)[0] as any).schema,
        );
      return { ...e, params };
    });
    for (const view of viewList) {
      const otherViews = viewList.filter((v) => v.name !== view.name);
      const cps = await this.agentsService.genVue2Components({
        view,
        otherViews,
        components,
        endpoints,
        packages: this.initPackagesComponent,
        event: data,
      });
      Object.entries(cps).forEach(([name, comp]) => {
        const cp = components[name];
        if (cp) {
          cp.inViews.push(view.name);
          Object.assign(cp, comp);
        } else components[name] = { ...comp, inViews: [view.name] };
      });
    }
    const viewComps: { [view: string]: string[] } = {};
    Object.entries(components).map(([name, comp]) =>
      comp.inViews.forEach((view) => {
        const comps = viewComps[view] || (viewComps[view] = []);
        comps.push(name);
      }),
    );

    // 3. choose needed service endpoints for each component: {comp: [apis]};
    // TODO filter by view distances
    // const compApis = await this.agentsService.genVue3Apis({
    //   endpoints,
    //   compsList,
    //   bizKey: data.id,
    //   callgent: data.context.callgent,
    // });

    // 3. generate `components/*.vue` code, which may import `stores/*.js`;
    const stores: {
      file: string;
      state: object;
      actions: string[];
      getters: object[];
      endpoints: string[];
    }[] = [];
    let packages: string[] = this.initPackagesComponent;
    let entries = Object.entries(components);
    for (const [compName, comp] of entries) {
      // endpoints for the component
      const endpoints = comp.endpoints.map((epName) => {
        const ep = data.context.endpoints.find((ep) => ep.name === epName);
        return { name: ep.name, params: ep.params, responses: ep.responses };
      });
      // list related views
      const relatedViews = components[compName].inViews.map((view) => ({
        name: view,
        path: viewMap[view].path,
        title: viewMap[view].title,
        summary: viewMap[view].summary,
        instruction: viewMap[view].instruction,
        components: viewComps[view],
      }));
      const otherViews = viewList
        .filter((v) => !relatedViews.find((v0) => v0.name === v.name))
        .map((v) => ({ name: v.name, path: v.path, summary: v.summary }));

      // and comps related to the views
      const relatedComps: {
        name: string;
        // props: string[];
        file?: string;
        summary: string;
        instruction?: string;
        endpoints?: { name: string; params: object; responses: object }[];
      }[] = [...new Set(relatedViews.map((v) => viewComps[v.name]).flat())]
        .filter((c) => c !== compName)
        .map((c) => ({
          name: c,
          // props: components[c].props,
          spec: components[c].spec,
          summary: components[c].summary,
          instruction: components[c].instruction,
        }));
      relatedComps.unshift({
        name: compName,
        file: components[compName].file,
        ...comp,
        endpoints,
      });

      const component = await this.agentsService.genVue3Component({
        components: relatedComps,
        relatedViews,
        otherViews,
        stores,
        packages,
        event: data,
      });
      files[components[compName].file] = component.code;

      // add spec
      (comp as any).spec = component.spec;
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
    entries = undefined;

    // 4. generate `stores/*.js` used by components, bind `actions` to service endpoints.
    packages.push(...this.initPackagesStore);
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

      const storeResult = await this.agentsService.genVue4Store({
        packages,
        store: { ...store, endpoints },
        apiBaseUrl,
        event: data,
      });
      // merge packages
      storeResult.packages?.length &&
        (packages = [...new Set([...packages, ...storeResult.packages])]);
      files[store.file] = storeResult.code;
    }

    // 5. generate `views/*.vue` code, which imports `components/*.js`, and `stores/*.js` if really needed.
    // change view descriptions
    let entries1 = Object.entries(viewComps);
    for (const [name, compNames] of entries1) {
      const view = { name, ...viewMap[name], distance: undefined };
      const otherViews = viewList
        .filter((v) => v.name !== name)
        .map((v) => ({ name: v.name, title: v.title, path: v.path }));
      const comps = compNames.map((compName) => ({
        name: compName,
        spec: null,
        ...components[compName],
        endpoints: undefined,
        inViews: undefined,
      }));
      const result = await this.agentsService.genVue5View({
        view,
        otherViews,
        components: comps,
        packages,
        event: data,
      });
      result.packages?.length &&
        (packages = [...new Set([...packages, ...result.packages])]);
      files[view.file] = result.code;
    }
    entries1 = undefined;

    // 6. needn't generate App.vue, main.js

    data.context.resp = {
      data: {
        packages,
        files,
        routes: viewList.map((v) => ({
          name: v.name,
          path: v.path,
          component: v.component,
        })),
      },
      status: 200,
    };
    this.logger.debug(JSON.stringify(data.context.resp));
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

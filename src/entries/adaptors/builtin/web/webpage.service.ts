import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable } from '@nestjs/common';
import { AgentsService } from '../../../../agents/agents.service';
import { ClientRequestEvent } from '../../../events/client-request.event';

@Injectable()
export class WebpageService {
  constructor(
    @Inject('AgentsService')
    private readonly agentsService: AgentsService,
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

    const files: { [filePath: string]: string } = {};

    // generate route
    const agentData: any = {
      srcId: data.srcId,
      callgent: data.context.callgent,
      requirement: data.context.req.requirement,
    };
    // 1. generate `router/index.js`, only necessary `views` for the requirement
    const route = await this.agentsService.genVue1Route(agentData);
    files['/src/routes/index.js'] = route['router/index.js'];
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
    }[] = [];
    const packages: string[] = [];
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
        srcId: data.srcId,
      });
      files[components[0].file] = component.code;

      // merge packages
      component.packages?.length && packages.push(...component.packages);
      // merge stores
      component.importedStores?.forEach((store) => {
        const s = stores.find((s) => s.file === store.file);
        if (s) {
          store.state && (s.state = { ...s.state, ...store.state }); // TODO deep merge?
          store.actions?.length &&
            (s.actions = [...s.actions, ...store.actions]);
          store.getters?.length &&
            (s.getters = [...s.getters, ...store.getters]);
        } else stores.push(store);
      });
    }

    // 5. generate `stores/*.js` used by components, bind `actions` to service endpoints.
    // 6. generate `views/*.vue` code, which imports `components/*.js`, and `stores/*.js` if really needed.
    // 7. generate App.vue, main.js

    return { data };
  }
}

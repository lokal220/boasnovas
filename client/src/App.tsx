/**
 * Rotas do app (SPEC §7). Cada tela vive em client/src/telas e é carregada sob demanda.
 * Contrato de módulos: cada arquivo exporta a função com o nome indicado abaixo.
 */
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Route, Switch } from 'wouter';
import '@/estilos/tokens.css';
import '@/estilos/base.css';

function sob<T extends ComponentType<any>>(carregar: () => Promise<Record<string, unknown>>, nome: string) {
  return lazy(async () => ({ default: (await carregar())[nome] as T }));
}

const TelaInicio = sob(() => import('@/telas/Inicio'), 'TelaInicio');
const TelaNaoEncontrado = sob(() => import('@/telas/NaoEncontrado'), 'TelaNaoEncontrado');
const TelaEscalaPublica = sob<ComponentType<{ token: string }>>(() => import('@/telas/publico/TelaEscalaPublica'), 'TelaEscalaPublica');
const TelaMinhaEscala = sob<ComponentType<{ token: string }>>(() => import('@/telas/voluntario/TelaMinhaEscala'), 'TelaMinhaEscala');
const TelaLogin = sob(() => import('@/telas/lider/TelaLogin'), 'TelaLogin');
const LayoutLider = sob<ComponentType<{ children: ReactNode }>>(() => import('@/telas/lider/LayoutLider'), 'LayoutLider');
const TelaPainel = sob(() => import('@/telas/lider/TelaPainel'), 'TelaPainel');
const TelaCultos = sob(() => import('@/telas/lider/TelaCultos'), 'TelaCultos');
const TelaEquipe = sob(() => import('@/telas/lider/TelaEquipe'), 'TelaEquipe');
const TelaImportar = sob(() => import('@/telas/lider/TelaImportar'), 'TelaImportar');
const TelaExportar = sob(() => import('@/telas/lider/TelaExportar'), 'TelaExportar');
const TelaAjustes = sob(() => import('@/telas/lider/TelaAjustes'), 'TelaAjustes');
const TelaTelao = sob<ComponentType<{ cultoId: string }>>(() => import('@/telas/lider/TelaTelao'), 'TelaTelao');
const TelaMostruario = sob(() => import('@/telas/dev/Mostruario'), 'TelaMostruario');

function Carregando() {
  return <div aria-busy="true" style={{ minHeight: '40vh' }} />;
}

export function App() {
  return (
    <Suspense fallback={<Carregando />}>
      <Switch>
        <Route path="/"><TelaInicio /></Route>
        <Route path="/e/:token">{(p) => <TelaEscalaPublica token={p.token} />}</Route>
        <Route path="/v/:token">{(p) => <TelaMinhaEscala token={p.token} />}</Route>
        <Route path="/lider"><TelaLogin /></Route>
        <Route path="/lider/telao/:cultoId">{(p) => <TelaTelao cultoId={p.cultoId} />}</Route>
        <Route path="/lider/painel"><LayoutLider><TelaPainel /></LayoutLider></Route>
        <Route path="/lider/cultos"><LayoutLider><TelaCultos /></LayoutLider></Route>
        <Route path="/lider/equipe"><LayoutLider><TelaEquipe /></LayoutLider></Route>
        <Route path="/lider/importar"><LayoutLider><TelaImportar /></LayoutLider></Route>
        <Route path="/lider/exportar"><LayoutLider><TelaExportar /></LayoutLider></Route>
        <Route path="/lider/ajustes"><LayoutLider><TelaAjustes /></LayoutLider></Route>
        {import.meta.env.DEV && <Route path="/dev/ui"><TelaMostruario /></Route>}
        <Route><TelaNaoEncontrado /></Route>
      </Switch>
    </Suspense>
  );
}

import { Route, Switch } from 'wouter';

/** Rotas do app. As telas são implementadas em client/src/telas. */
export function App() {
  return (
    <Switch>
      <Route path="/">
        <main style={{ padding: 24, fontFamily: 'Inter, sans-serif' }}>
          <h1 style={{ fontFamily: '"Inter Tight", sans-serif', fontWeight: 300 }}>escalas · boas novas</h1>
        </main>
      </Route>
    </Switch>
  );
}

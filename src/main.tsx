import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { Workflow } from './ui/workflow/Workflow';
import './ui/styles.css';

// Hash routes work on GitHub Pages without server config:
//   #/          the compiler (editor + six phase panels)
//   #/workflow  the presentation dashboard explaining the six phases
function Router() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash.startsWith('#/workflow') ? <Workflow key="wf" /> : <App key="app" />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);

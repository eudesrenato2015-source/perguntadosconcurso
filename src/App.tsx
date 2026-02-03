import React, { useEffect } from "react";
import { NavLink, Route, Routes, Link } from "react-router-dom";
import Arena from "./pages/Arena";
import Duel from "./pages/Duel";
import DuelMatch from "./pages/DuelMatch";
import Campaign from "./pages/Campaign";
import Library from "./pages/Library";
import Review from "./pages/Review";
import Profile from "./pages/Profile";
import QuestionRunner from "./pages/QuestionRunner";
import Result from "./pages/Result";
import Dashboard from "./pages/Dashboard";
import ImportPage from "./pages/Import";
import Login from "./pages/Login";
import Ranking from "./pages/Ranking";
import Admin from "./pages/Admin";
import { useTheme } from "./services/theme";
import UpdateToast from "./components/UpdateToast";
import AppIcon from "./components/AppIcon";
import { usePwaInstall } from "./services/pwaInstall";
import { loadQuestionOverrides, subscribeQuestionOverrides, loadQuestionCustoms, subscribeQuestionCustoms } from "./services/questionOverrides";

export default function App(){
  const { theme, toggle } = useTheme();
  useEffect(() => {
    loadQuestionOverrides();
    loadQuestionCustoms();
    const unsubOverrides = subscribeQuestionOverrides();
    const unsubCustoms = subscribeQuestionCustoms();
    return () => { unsubOverrides(); unsubCustoms(); };
  }, []);
  const themeLabel = theme === "light" ? "Claro" : theme === "dark" ? "Escuro" : theme;
  const { canInstall, promptInstall } = usePwaInstall();

  return (
    <div data-theme={theme}>
      <UpdateToast />
      <div className="container">
        <div className="row" style={{ justifyContent:"space-between", marginBottom: 12, alignItems:"flex-start", flexWrap:"wrap" }}>
          <div>
            <div className="h1">Jogo do Concurseiro</div>
            <div className="sub">by: Eldes Renato Cardoso da Silva Alvarenga</div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap:"wrap" }}>
            {canInstall && (
              <button className="btn" onClick={promptInstall}>Instalar</button>
            )}
            <Link className="btn" to="/login">Login</Link>
            <Link className="btn" to="/ranking">Ranking</Link>
            <Link className="btn" to="/admin">Admin</Link>
            <Link className="btn" to="/perfil">Perfil</Link>
            <Link className="btn" to="/importar">Importar</Link>
            <button className="btn" onClick={toggle} aria-label="Alternar tema">
              Tema: {themeLabel}
            </button>
          </div>
        </div>

        <div className="card">
          <Routes>
            <Route path="/" element={<Arena />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/duelo" element={<Duel />} />
            <Route path="/duelo/jogo" element={<DuelMatch />} />
            <Route path="/campanha" element={<Campaign />} />
            <Route path="/biblioteca" element={<Library />} />
            <Route path="/revisao" element={<Review />} />
            <Route path="/perfil" element={<Profile />} />
            <Route path="/importar" element={<ImportPage />} />
            <Route path="/questao" element={<QuestionRunner />} />
            <Route path="/resultado" element={<Result />} />
            <Route path="/login" element={<Login />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<div style={{ padding: 16 }}>Página não encontrada.</div>} />
          </Routes>
        </div>
      </div>

      <nav className="navbar" aria-label="Navegação inferior">
        <div className="navbarInner" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
          <Tab to="/" label="Arena" end icon="arena" />
          <Tab to="/dashboard" label="Dashboard" icon="dashboard" />
          <Tab to="/duelo" label="Duelo" icon="duel" />
          <Tab to="/campanha" label="Campanha" icon="campaign" />
          <Tab to="/biblioteca" label="Biblioteca" icon="library" />
          <Tab to="/revisao" label="Revisão" icon="review" />
        </div>
      </nav>
    </div>
  );
}

function Tab({ to, label, end, icon }: { to: string; label: string; end?: boolean; icon: React.ComponentProps<typeof AppIcon>["name"] }){
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => "navItem" + (isActive ? " navItemActive" : "")}
    >
      <AppIcon name={icon} size={20} />
      <span>{label}</span>
    </NavLink>
  );
}

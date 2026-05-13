import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Videos from "./pages/Videos";
import Analytics from "./pages/Analytics";
import Shills from "./pages/Shills";
import Reports from "./pages/Reports";
import AdminPanel from "./pages/AdminPanel";
import Channels from "./pages/Channels";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/videos" component={Videos} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/shills" component={Shills} />
        <Route path="/reports" component={Reports} />
        <Route path="/channels" component={Channels} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors theme="dark" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

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
import AgencyDashboardPage from "./pages/agency/AgencyDashboard";
import ClientsPage from "./pages/agency/Clients";
import CampaignsPage from "./pages/agency/Campaigns";
import CampaignDetailPage from "./pages/agency/CampaignDetail";
import TalentsPage from "./pages/agency/Talents";
import AffiliatePage from "./pages/agency/Affiliate";
import InvoicesPage from "./pages/agency/Invoices";
import EmailsPage from "./pages/agency/Emails";
import ResultsPage from "./pages/agency/Results";

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
        <Route path="/agency" component={AgencyDashboardPage} />
        <Route path="/agency/clients" component={ClientsPage} />
        <Route path="/agency/campaigns/:id" component={CampaignDetailPage} />
        <Route path="/agency/campaigns" component={CampaignsPage} />
        <Route path="/agency/talents" component={TalentsPage} />
        <Route path="/agency/affiliate" component={AffiliatePage} />
        <Route path="/agency/invoices" component={InvoicesPage} />
        <Route path="/agency/emails" component={EmailsPage} />
        <Route path="/agency/results" component={ResultsPage} />
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

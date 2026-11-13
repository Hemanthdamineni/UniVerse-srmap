// EventWorkflowPages — orchestrating container.
// Each page now lives in a focused module under ./components/ and is re-exported
// here so that src/routes/eventRoutes.tsx lazy() imports keep working unchanged.
export { CertificateClaimPage } from "./components/CertificateClaimPage";
export { CertificateTemplatePage } from "./components/CertificateTemplatePage";
export { MyTeamsPage } from "./components/MyTeamsPage";
export { PersistentTeamPage } from "./components/PersistentTeamPage";
export { RegistrationFlowPage } from "./components/RegistrationFlowPage";
export { RolesPage } from "./components/RolesPage";
export { TeamDetailPage } from "./components/TeamDetailPage";
export { TeamFormationPage } from "./components/TeamFormationPage";
export { InvitationsPage } from "./components/InvitationsPage";
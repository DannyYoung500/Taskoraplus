/* eslint-disable */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols
// TASKORA route tree — includes ban/suspend/maintenance

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AuthRouteImport } from './routes/auth'
import { Route as TelegramGateRouteImport } from './routes/telegram-gate'
import { Route as BannedRouteImport } from './routes/banned'
import { Route as SuspendedRouteImport } from './routes/suspended'
import { Route as MaintenanceRouteImport } from './routes/maintenance'
import { Route as AuthenticatedRouteRouteImport } from './routes/_authenticated/route'
import { Route as AuthenticatedAdvertiseRouteImport } from './routes/_authenticated/advertise'
import { Route as AuthenticatedAmbassadorRouteImport } from './routes/_authenticated/ambassador'
import { Route as AuthenticatedConnectedRouteImport } from './routes/_authenticated/connected'
import { Route as AuthenticatedHomeRouteImport } from './routes/_authenticated/home'
import { Route as AuthenticatedLeaderboardRouteImport } from './routes/_authenticated/leaderboard'
import { Route as AuthenticatedNotificationsRouteImport } from './routes/_authenticated/notifications'
import { Route as AuthenticatedProfileRouteImport } from './routes/_authenticated/profile'
import { Route as AuthenticatedSupportRouteImport } from './routes/_authenticated/support'
import { Route as AuthenticatedWalletRouteImport } from './routes/_authenticated/wallet'
import { Route as AuthenticatedWatchEarnRouteImport } from './routes/_authenticated/watch-earn'
import { Route as AuthenticatedOwnerIndexRouteImport } from './routes/_authenticated/owner.index'
import { Route as AuthenticatedOwnerReviewsRouteImport } from './routes/_authenticated/owner.reviews'
import { Route as AuthenticatedOwnerWithdrawalsRouteImport } from './routes/_authenticated/owner.withdrawals'
import { Route as AuthenticatedOwnerUsersRouteImport } from './routes/_authenticated/owner.users'
import { Route as AuthenticatedOwnerTasksRouteImport } from './routes/_authenticated/owner.tasks'
import { Route as AuthenticatedOwnerFraudRouteImport } from './routes/_authenticated/owner.fraud'
import { Route as AuthenticatedOwnerAnalyticsRouteImport } from './routes/_authenticated/owner.analytics'
import { Route as AuthenticatedOwnerSettingsRouteImport } from './routes/_authenticated/owner.settings'
import { Route as AuthenticatedOwnerTicketsRouteImport } from './routes/_authenticated/owner.tickets'
import { Route as AuthenticatedOwnerAnnounceRouteImport } from './routes/_authenticated/owner.announce'
import { Route as AuthenticatedOwnerWelcomeRouteImport } from './routes/_authenticated/owner.welcome'
import { Route as AuthenticatedOwnerCampaignsRouteImport } from './routes/_authenticated/owner.campaigns'
import { Route as AuthenticatedOwnerLedgerRouteImport } from './routes/_authenticated/owner.ledger'
import { Route as AuthenticatedOwnerDepositsRouteImport } from './routes/_authenticated/owner.deposits'
import { Route as AuthenticatedOwnerConnectedRouteImport } from './routes/_authenticated/owner.connected'
import { Route as AuthenticatedOwnerRolesRouteImport } from './routes/_authenticated/owner.roles'
import { Route as AuthenticatedOwnerEconomyRouteImport } from './routes/_authenticated/owner.economy'
import { Route as AuthenticatedOwnerFlagsRouteImport } from './routes/_authenticated/owner.flags'
import { Route as AuthenticatedOwnerAuditRouteImport } from './routes/_authenticated/owner.audit'
import { Route as AuthenticatedOwnerHealthRouteImport } from './routes/_authenticated/owner.health'
import { Route as AuthenticatedOwnerDocumentsRouteImport } from './routes/_authenticated/owner.documents'
import { Route as AuthenticatedOwnerMonetizationRouteImport } from './routes/_authenticated/owner.monetization'
import { Route as AuthenticatedOwnerVideosRouteImport } from './routes/_authenticated/owner.videos'
import { Route as AuthenticatedOwnerPaymentSettingsRouteImport } from './routes/_authenticated/owner/payment-settings'
import { Route as AuthenticatedTasksIndexRouteImport } from './routes/_authenticated/tasks.index'
import { Route as AuthenticatedTasksTaskIdRouteImport } from './routes/_authenticated/tasks.$taskId'

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any)
const AuthRoute = AuthRouteImport.update({ id: '/auth', path: '/auth', getParentRoute: () => rootRouteImport } as any)
const TelegramGateRoute = TelegramGateRouteImport.update({ id: '/telegram-gate', path: '/telegram-gate', getParentRoute: () => rootRouteImport } as any)
const BannedRoute = BannedRouteImport.update({ id: '/banned', path: '/banned', getParentRoute: () => rootRouteImport } as any)
const SuspendedRoute = SuspendedRouteImport.update({ id: '/suspended', path: '/suspended', getParentRoute: () => rootRouteImport } as any)
const MaintenanceRoute = MaintenanceRouteImport.update({ id: '/maintenance', path: '/maintenance', getParentRoute: () => rootRouteImport } as any)
const AuthenticatedRouteRoute = AuthenticatedRouteRouteImport.update({ id: '/_authenticated', getParentRoute: () => rootRouteImport } as any)

const AuthenticatedAdvertiseRoute = AuthenticatedAdvertiseRouteImport.update({ id: '/_authenticated/advertise', path: '/advertise', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedAmbassadorRoute = AuthenticatedAmbassadorRouteImport.update({ id: '/_authenticated/ambassador', path: '/ambassador', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedConnectedRoute = AuthenticatedConnectedRouteImport.update({ id: '/_authenticated/connected', path: '/connected', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedHomeRoute = AuthenticatedHomeRouteImport.update({ id: '/_authenticated/home', path: '/home', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedLeaderboardRoute = AuthenticatedLeaderboardRouteImport.update({ id: '/_authenticated/leaderboard', path: '/leaderboard', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedNotificationsRoute = AuthenticatedNotificationsRouteImport.update({ id: '/_authenticated/notifications', path: '/notifications', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedProfileRoute = AuthenticatedProfileRouteImport.update({ id: '/_authenticated/profile', path: '/profile', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedSupportRoute = AuthenticatedSupportRouteImport.update({ id: '/_authenticated/support', path: '/support', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedWalletRoute = AuthenticatedWalletRouteImport.update({ id: '/_authenticated/wallet', path: '/wallet', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedWatchEarnRoute = AuthenticatedWatchEarnRouteImport.update({ id: '/_authenticated/watch-earn', path: '/watch-earn', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerIndexRoute = AuthenticatedOwnerIndexRouteImport.update({ id: '/_authenticated/owner/', path: '/owner', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerReviewsRoute = AuthenticatedOwnerReviewsRouteImport.update({ id: '/_authenticated/owner/reviews', path: '/owner/reviews', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerWithdrawalsRoute = AuthenticatedOwnerWithdrawalsRouteImport.update({ id: '/_authenticated/owner/withdrawals', path: '/owner/withdrawals', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerUsersRoute = AuthenticatedOwnerUsersRouteImport.update({ id: '/_authenticated/owner/users', path: '/owner/users', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerTasksRoute = AuthenticatedOwnerTasksRouteImport.update({ id: '/_authenticated/owner/tasks', path: '/owner/tasks', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerFraudRoute = AuthenticatedOwnerFraudRouteImport.update({ id: '/_authenticated/owner/fraud', path: '/owner/fraud', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerAnalyticsRoute = AuthenticatedOwnerAnalyticsRouteImport.update({ id: '/_authenticated/owner/analytics', path: '/owner/analytics', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerSettingsRoute = AuthenticatedOwnerSettingsRouteImport.update({ id: '/_authenticated/owner/settings', path: '/owner/settings', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerTicketsRoute = AuthenticatedOwnerTicketsRouteImport.update({ id: '/_authenticated/owner/tickets', path: '/owner/tickets', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerAnnounceRoute = AuthenticatedOwnerAnnounceRouteImport.update({ id: '/_authenticated/owner/announce', path: '/owner/announce', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerWelcomeRoute = AuthenticatedOwnerWelcomeRouteImport.update({ id: '/_authenticated/owner/welcome', path: '/owner/welcome', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerCampaignsRoute = AuthenticatedOwnerCampaignsRouteImport.update({ id: '/_authenticated/owner/campaigns', path: '/owner/campaigns', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerLedgerRoute = AuthenticatedOwnerLedgerRouteImport.update({ id: '/_authenticated/owner/ledger', path: '/owner/ledger', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerDepositsRoute = AuthenticatedOwnerDepositsRouteImport.update({ id: '/_authenticated/owner/deposits', path: '/owner/deposits', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerConnectedRoute = AuthenticatedOwnerConnectedRouteImport.update({ id: '/_authenticated/owner/connected', path: '/owner/connected', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerRolesRoute = AuthenticatedOwnerRolesRouteImport.update({ id: '/_authenticated/owner/roles', path: '/owner/roles', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerEconomyRoute = AuthenticatedOwnerEconomyRouteImport.update({ id: '/_authenticated/owner/economy', path: '/owner/economy', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerFlagsRoute = AuthenticatedOwnerFlagsRouteImport.update({ id: '/_authenticated/owner/flags', path: '/owner/flags', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerAuditRoute = AuthenticatedOwnerAuditRouteImport.update({ id: '/_authenticated/owner/audit', path: '/owner/audit', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerHealthRoute = AuthenticatedOwnerHealthRouteImport.update({ id: '/_authenticated/owner/health', path: '/owner/health', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerDocumentsRoute = AuthenticatedOwnerDocumentsRouteImport.update({ id: '/_authenticated/owner/documents', path: '/owner/documents', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerMonetizationRoute = AuthenticatedOwnerMonetizationRouteImport.update({ id: '/_authenticated/owner/monetization', path: '/owner/monetization', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerVideosRoute = AuthenticatedOwnerVideosRouteImport.update({ id: '/_authenticated/owner/videos', path: '/owner/videos', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerPaymentSettingsRoute = AuthenticatedOwnerPaymentSettingsRouteImport.update({ id: '/_authenticated/owner/payment-settings', path: '/owner/payment-settings', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedTasksIndexRoute = AuthenticatedTasksIndexRouteImport.update({ id: '/_authenticated/tasks/', path: '/tasks', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedTasksTaskIdRoute = AuthenticatedTasksTaskIdRouteImport.update({ id: '/_authenticated/tasks/$taskId', path: '/tasks/$taskId', getParentRoute: () => AuthenticatedRouteRoute } as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/auth': typeof AuthRoute
  '/telegram-gate': typeof TelegramGateRoute
  '/banned': typeof BannedRoute
  '/suspended': typeof SuspendedRoute
  '/maintenance': typeof MaintenanceRoute
  '/advertise': typeof AuthenticatedAdvertiseRoute
  '/ambassador': typeof AuthenticatedAmbassadorRoute
  '/connected': typeof AuthenticatedConnectedRoute
  '/home': typeof AuthenticatedHomeRoute
  '/leaderboard': typeof AuthenticatedLeaderboardRoute
  '/notifications': typeof AuthenticatedNotificationsRoute
  '/profile': typeof AuthenticatedProfileRoute
  '/support': typeof AuthenticatedSupportRoute
  '/wallet': typeof AuthenticatedWalletRoute
  '/watch-earn': typeof AuthenticatedWatchEarnRoute
  '/owner': typeof AuthenticatedOwnerIndexRoute
  '/owner/reviews': typeof AuthenticatedOwnerReviewsRoute
  '/owner/withdrawals': typeof AuthenticatedOwnerWithdrawalsRoute
  '/owner/users': typeof AuthenticatedOwnerUsersRoute
  '/owner/tasks': typeof AuthenticatedOwnerTasksRoute
  '/owner/fraud': typeof AuthenticatedOwnerFraudRoute
  '/owner/analytics': typeof AuthenticatedOwnerAnalyticsRoute
  '/owner/settings': typeof AuthenticatedOwnerSettingsRoute
  '/owner/tickets': typeof AuthenticatedOwnerTicketsRoute
  '/owner/announce': typeof AuthenticatedOwnerAnnounceRoute
  '/owner/welcome': typeof AuthenticatedOwnerWelcomeRoute
  '/owner/campaigns': typeof AuthenticatedOwnerCampaignsRoute
  '/owner/ledger': typeof AuthenticatedOwnerLedgerRoute
  '/owner/deposits': typeof AuthenticatedOwnerDepositsRoute
  '/owner/connected': typeof AuthenticatedOwnerConnectedRoute
  '/owner/roles': typeof AuthenticatedOwnerRolesRoute
  '/owner/economy': typeof AuthenticatedOwnerEconomyRoute
  '/owner/flags': typeof AuthenticatedOwnerFlagsRoute
  '/owner/audit': typeof AuthenticatedOwnerAuditRoute
  '/owner/health': typeof AuthenticatedOwnerHealthRoute
  '/owner/documents': typeof AuthenticatedOwnerDocumentsRoute
  '/owner/monetization': typeof AuthenticatedOwnerMonetizationRoute
  '/owner/videos': typeof AuthenticatedOwnerVideosRoute
  '/owner/payment-settings': typeof AuthenticatedOwnerPaymentSettingsRoute
  '/tasks': typeof AuthenticatedTasksIndexRoute
  '/tasks/$taskId': typeof AuthenticatedTasksTaskIdRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/auth': typeof AuthRoute
  '/telegram-gate': typeof TelegramGateRoute
  '/banned': typeof BannedRoute
  '/suspended': typeof SuspendedRoute
  '/maintenance': typeof MaintenanceRoute
  '/advertise': typeof AuthenticatedAdvertiseRoute
  '/ambassador': typeof AuthenticatedAmbassadorRoute
  '/connected': typeof AuthenticatedConnectedRoute
  '/home': typeof AuthenticatedHomeRoute
  '/leaderboard': typeof AuthenticatedLeaderboardRoute
  '/notifications': typeof AuthenticatedNotificationsRoute
  '/profile': typeof AuthenticatedProfileRoute
  '/support': typeof AuthenticatedSupportRoute
  '/wallet': typeof AuthenticatedWalletRoute
  '/watch-earn': typeof AuthenticatedWatchEarnRoute
  '/owner': typeof AuthenticatedOwnerIndexRoute
  '/owner/reviews': typeof AuthenticatedOwnerReviewsRoute
  '/owner/withdrawals': typeof AuthenticatedOwnerWithdrawalsRoute
  '/owner/users': typeof AuthenticatedOwnerUsersRoute
  '/owner/tasks': typeof AuthenticatedOwnerTasksRoute
  '/owner/fraud': typeof AuthenticatedOwnerFraudRoute
  '/owner/analytics': typeof AuthenticatedOwnerAnalyticsRoute
  '/owner/settings': typeof AuthenticatedOwnerSettingsRoute
  '/owner/tickets': typeof AuthenticatedOwnerTicketsRoute
  '/owner/announce': typeof AuthenticatedOwnerAnnounceRoute
  '/owner/welcome': typeof AuthenticatedOwnerWelcomeRoute
  '/owner/campaigns': typeof AuthenticatedOwnerCampaignsRoute
  '/owner/ledger': typeof AuthenticatedOwnerLedgerRoute
  '/owner/deposits': typeof AuthenticatedOwnerDepositsRoute
  '/owner/connected': typeof AuthenticatedOwnerConnectedRoute
  '/owner/roles': typeof AuthenticatedOwnerRolesRoute
  '/owner/economy': typeof AuthenticatedOwnerEconomyRoute
  '/owner/flags': typeof AuthenticatedOwnerFlagsRoute
  '/owner/audit': typeof AuthenticatedOwnerAuditRoute
  '/owner/health': typeof AuthenticatedOwnerHealthRoute
  '/owner/documents': typeof AuthenticatedOwnerDocumentsRoute
  '/owner/monetization': typeof AuthenticatedOwnerMonetizationRoute
  '/owner/videos': typeof AuthenticatedOwnerVideosRoute
  '/owner/payment-settings': typeof AuthenticatedOwnerPaymentSettingsRoute
  '/tasks': typeof AuthenticatedTasksIndexRoute
  '/tasks/$taskId': typeof AuthenticatedTasksTaskIdRoute
}

const AuthenticatedRouteRouteChildren = {
  AuthenticatedAdvertiseRoute,
  AuthenticatedAmbassadorRoute,
  AuthenticatedConnectedRoute,
  AuthenticatedHomeRoute,
  AuthenticatedLeaderboardRoute,
  AuthenticatedNotificationsRoute,
  AuthenticatedProfileRoute,
  AuthenticatedSupportRoute,
  AuthenticatedWalletRoute,
  AuthenticatedWatchEarnRoute,
  AuthenticatedOwnerIndexRoute,
  AuthenticatedOwnerReviewsRoute,
  AuthenticatedOwnerWithdrawalsRoute,
  AuthenticatedOwnerUsersRoute,
  AuthenticatedOwnerTasksRoute,
  AuthenticatedOwnerFraudRoute,
  AuthenticatedOwnerAnalyticsRoute,
  AuthenticatedOwnerSettingsRoute,
  AuthenticatedOwnerTicketsRoute,
  AuthenticatedOwnerAnnounceRoute,
  AuthenticatedOwnerWelcomeRoute,
  AuthenticatedOwnerCampaignsRoute,
  AuthenticatedOwnerLedgerRoute,
  AuthenticatedOwnerDepositsRoute,
  AuthenticatedOwnerConnectedRoute,
  AuthenticatedOwnerRolesRoute,
  AuthenticatedOwnerEconomyRoute,
  AuthenticatedOwnerFlagsRoute,
  AuthenticatedOwnerAuditRoute,
  AuthenticatedOwnerHealthRoute,
  AuthenticatedOwnerDocumentsRoute,
  AuthenticatedOwnerMonetizationRoute,
  AuthenticatedOwnerVideosRoute,
  AuthenticatedOwnerPaymentSettingsRoute,
  AuthenticatedTasksIndexRoute,
  AuthenticatedTasksTaskIdRoute,
}

const AuthenticatedRouteRouteWithChildren = AuthenticatedRouteRoute._addFileChildren(AuthenticatedRouteRouteChildren)

const rootRouteChildren = {
  IndexRoute,
  AuthRoute,
  TelegramGateRoute,
  BannedRoute,
  SuspendedRoute,
  MaintenanceRoute,
  AuthenticatedRouteRoute: AuthenticatedRouteRouteWithChildren,
}

export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)

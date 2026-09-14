/* eslint-disable */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols
// Generated for TASKORA — includes telegram-gate + owner routes

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AuthRouteImport } from './routes/auth'
import { Route as TelegramGateRouteImport } from './routes/telegram-gate'
import { Route as AuthenticatedRouteRouteImport } from './routes/_authenticated/route'
import { Route as AuthenticatedAdvertiseRouteImport } from './routes/_authenticated/advertise'
import { Route as AuthenticatedAmbassadorRouteImport } from './routes/_authenticated/ambassador'
import { Route as AuthenticatedConnectedRouteImport } from './routes/_authenticated/connected'
import { Route as AuthenticatedHomeRouteImport } from './routes/_authenticated/home'
import { Route as AuthenticatedLeaderboardRouteImport } from './routes/_authenticated/leaderboard'
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
import { Route as AuthenticatedTasksIndexRouteImport } from './routes/_authenticated/tasks.index'
import { Route as AuthenticatedTasksTaskIdRouteImport } from './routes/_authenticated/tasks.$taskId'

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any)
const AuthRoute = AuthRouteImport.update({ id: '/auth', path: '/auth', getParentRoute: () => rootRouteImport } as any)
const TelegramGateRoute = TelegramGateRouteImport.update({ id: '/telegram-gate', path: '/telegram-gate', getParentRoute: () => rootRouteImport } as any)
const AuthenticatedRouteRoute = AuthenticatedRouteRouteImport.update({ id: '/_authenticated', getParentRoute: () => rootRouteImport } as any)

const AuthenticatedAdvertiseRoute = AuthenticatedAdvertiseRouteImport.update({ id: '/advertise', path: '/advertise', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedAmbassadorRoute = AuthenticatedAmbassadorRouteImport.update({ id: '/ambassador', path: '/ambassador', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedConnectedRoute = AuthenticatedConnectedRouteImport.update({ id: '/connected', path: '/connected', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedHomeRoute = AuthenticatedHomeRouteImport.update({ id: '/home', path: '/home', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedLeaderboardRoute = AuthenticatedLeaderboardRouteImport.update({ id: '/leaderboard', path: '/leaderboard', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedProfileRoute = AuthenticatedProfileRouteImport.update({ id: '/profile', path: '/profile', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedSupportRoute = AuthenticatedSupportRouteImport.update({ id: '/support', path: '/support', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedWalletRoute = AuthenticatedWalletRouteImport.update({ id: '/wallet', path: '/wallet', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedWatchEarnRoute = AuthenticatedWatchEarnRouteImport.update({ id: '/watch-earn', path: '/watch-earn', getParentRoute: () => AuthenticatedRouteRoute } as any)

const AuthenticatedOwnerIndexRoute = AuthenticatedOwnerIndexRouteImport.update({ id: '/owner/', path: '/owner/', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerReviewsRoute = AuthenticatedOwnerReviewsRouteImport.update({ id: '/owner/reviews', path: '/owner/reviews', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerWithdrawalsRoute = AuthenticatedOwnerWithdrawalsRouteImport.update({ id: '/owner/withdrawals', path: '/owner/withdrawals', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerUsersRoute = AuthenticatedOwnerUsersRouteImport.update({ id: '/owner/users', path: '/owner/users', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerTasksRoute = AuthenticatedOwnerTasksRouteImport.update({ id: '/owner/tasks', path: '/owner/tasks', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerFraudRoute = AuthenticatedOwnerFraudRouteImport.update({ id: '/owner/fraud', path: '/owner/fraud', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerAnalyticsRoute = AuthenticatedOwnerAnalyticsRouteImport.update({ id: '/owner/analytics', path: '/owner/analytics', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerSettingsRoute = AuthenticatedOwnerSettingsRouteImport.update({ id: '/owner/settings', path: '/owner/settings', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerTicketsRoute = AuthenticatedOwnerTicketsRouteImport.update({ id: '/owner/tickets', path: '/owner/tickets', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedOwnerAnnounceRoute = AuthenticatedOwnerAnnounceRouteImport.update({ id: '/owner/announce', path: '/owner/announce', getParentRoute: () => AuthenticatedRouteRoute } as any)

const AuthenticatedTasksIndexRoute = AuthenticatedTasksIndexRouteImport.update({ id: '/tasks/', path: '/tasks/', getParentRoute: () => AuthenticatedRouteRoute } as any)
const AuthenticatedTasksTaskIdRoute = AuthenticatedTasksTaskIdRouteImport.update({ id: '/tasks/$taskId', path: '/tasks/$taskId', getParentRoute: () => AuthenticatedRouteRoute } as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/auth': typeof AuthRoute
  '/telegram-gate': typeof TelegramGateRoute
  '/advertise': typeof AuthenticatedAdvertiseRoute
  '/ambassador': typeof AuthenticatedAmbassadorRoute
  '/connected': typeof AuthenticatedConnectedRoute
  '/home': typeof AuthenticatedHomeRoute
  '/leaderboard': typeof AuthenticatedLeaderboardRoute
  '/profile': typeof AuthenticatedProfileRoute
  '/support': typeof AuthenticatedSupportRoute
  '/wallet': typeof AuthenticatedWalletRoute
  '/watch-earn': typeof AuthenticatedWatchEarnRoute
  '/owner/': typeof AuthenticatedOwnerIndexRoute
  '/owner/reviews': typeof AuthenticatedOwnerReviewsRoute
  '/owner/withdrawals': typeof AuthenticatedOwnerWithdrawalsRoute
  '/owner/users': typeof AuthenticatedOwnerUsersRoute
  '/owner/tasks': typeof AuthenticatedOwnerTasksRoute
  '/owner/fraud': typeof AuthenticatedOwnerFraudRoute
  '/owner/analytics': typeof AuthenticatedOwnerAnalyticsRoute
  '/owner/settings': typeof AuthenticatedOwnerSettingsRoute
  '/owner/tickets': typeof AuthenticatedOwnerTicketsRoute
  '/owner/announce': typeof AuthenticatedOwnerAnnounceRoute
  '/tasks/': typeof AuthenticatedTasksIndexRoute
  '/tasks/$taskId': typeof AuthenticatedTasksTaskIdRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/auth': typeof AuthRoute
  '/telegram-gate': typeof TelegramGateRoute
  '/advertise': typeof AuthenticatedAdvertiseRoute
  '/ambassador': typeof AuthenticatedAmbassadorRoute
  '/connected': typeof AuthenticatedConnectedRoute
  '/home': typeof AuthenticatedHomeRoute
  '/leaderboard': typeof AuthenticatedLeaderboardRoute
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
  '/tasks': typeof AuthenticatedTasksIndexRoute
  '/tasks/$taskId': typeof AuthenticatedTasksTaskIdRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/auth': typeof AuthRoute
  '/telegram-gate': typeof TelegramGateRoute
  '/_authenticated': typeof AuthenticatedRouteRouteWithChildren
  '/_authenticated/advertise': typeof AuthenticatedAdvertiseRoute
  '/_authenticated/ambassador': typeof AuthenticatedAmbassadorRoute
  '/_authenticated/connected': typeof AuthenticatedConnectedRoute
  '/_authenticated/home': typeof AuthenticatedHomeRoute
  '/_authenticated/leaderboard': typeof AuthenticatedLeaderboardRoute
  '/_authenticated/profile': typeof AuthenticatedProfileRoute
  '/_authenticated/support': typeof AuthenticatedSupportRoute
  '/_authenticated/wallet': typeof AuthenticatedWalletRoute
  '/_authenticated/watch-earn': typeof AuthenticatedWatchEarnRoute
  '/_authenticated/owner/': typeof AuthenticatedOwnerIndexRoute
  '/_authenticated/owner/reviews': typeof AuthenticatedOwnerReviewsRoute
  '/_authenticated/owner/withdrawals': typeof AuthenticatedOwnerWithdrawalsRoute
  '/_authenticated/owner/users': typeof AuthenticatedOwnerUsersRoute
  '/_authenticated/owner/tasks': typeof AuthenticatedOwnerTasksRoute
  '/_authenticated/owner/fraud': typeof AuthenticatedOwnerFraudRoute
  '/_authenticated/owner/analytics': typeof AuthenticatedOwnerAnalyticsRoute
  '/_authenticated/owner/settings': typeof AuthenticatedOwnerSettingsRoute
  '/_authenticated/owner/tickets': typeof AuthenticatedOwnerTicketsRoute
  '/_authenticated/owner/announce': typeof AuthenticatedOwnerAnnounceRoute
  '/_authenticated/tasks/': typeof AuthenticatedTasksIndexRoute
  '/_authenticated/tasks/$taskId': typeof AuthenticatedTasksTaskIdRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: keyof FileRoutesByFullPath
  fileRoutesByTo: FileRoutesByTo
  to: keyof FileRoutesByTo
  id: keyof FileRoutesById
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  AuthRoute: typeof AuthRoute
  TelegramGateRoute: typeof TelegramGateRoute
  AuthenticatedRouteRoute: typeof AuthenticatedRouteRouteWithChildren
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: typeof IndexRouteImport; parentRoute: typeof rootRouteImport }
    '/auth': { id: '/auth'; path: '/auth'; fullPath: '/auth'; preLoaderRoute: typeof AuthRouteImport; parentRoute: typeof rootRouteImport }
    '/telegram-gate': { id: '/telegram-gate'; path: '/telegram-gate'; fullPath: '/telegram-gate'; preLoaderRoute: typeof TelegramGateRouteImport; parentRoute: typeof rootRouteImport }
    '/_authenticated': { id: '/_authenticated'; path: ''; fullPath: '/'; preLoaderRoute: typeof AuthenticatedRouteRouteImport; parentRoute: typeof rootRouteImport }
    '/_authenticated/advertise': { id: '/_authenticated/advertise'; path: '/advertise'; fullPath: '/advertise'; preLoaderRoute: typeof AuthenticatedAdvertiseRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/ambassador': { id: '/_authenticated/ambassador'; path: '/ambassador'; fullPath: '/ambassador'; preLoaderRoute: typeof AuthenticatedAmbassadorRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/connected': { id: '/_authenticated/connected'; path: '/connected'; fullPath: '/connected'; preLoaderRoute: typeof AuthenticatedConnectedRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/home': { id: '/_authenticated/home'; path: '/home'; fullPath: '/home'; preLoaderRoute: typeof AuthenticatedHomeRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/leaderboard': { id: '/_authenticated/leaderboard'; path: '/leaderboard'; fullPath: '/leaderboard'; preLoaderRoute: typeof AuthenticatedLeaderboardRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/profile': { id: '/_authenticated/profile'; path: '/profile'; fullPath: '/profile'; preLoaderRoute: typeof AuthenticatedProfileRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/support': { id: '/_authenticated/support'; path: '/support'; fullPath: '/support'; preLoaderRoute: typeof AuthenticatedSupportRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/wallet': { id: '/_authenticated/wallet'; path: '/wallet'; fullPath: '/wallet'; preLoaderRoute: typeof AuthenticatedWalletRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/watch-earn': { id: '/_authenticated/watch-earn'; path: '/watch-earn'; fullPath: '/watch-earn'; preLoaderRoute: typeof AuthenticatedWatchEarnRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/owner/': { id: '/_authenticated/owner/'; path: '/owner'; fullPath: '/owner/'; preLoaderRoute: typeof AuthenticatedOwnerIndexRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/owner/reviews': { id: '/_authenticated/owner/reviews'; path: '/owner/reviews'; fullPath: '/owner/reviews'; preLoaderRoute: typeof AuthenticatedOwnerReviewsRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/owner/withdrawals': { id: '/_authenticated/owner/withdrawals'; path: '/owner/withdrawals'; fullPath: '/owner/withdrawals'; preLoaderRoute: typeof AuthenticatedOwnerWithdrawalsRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/owner/users': { id: '/_authenticated/owner/users'; path: '/owner/users'; fullPath: '/owner/users'; preLoaderRoute: typeof AuthenticatedOwnerUsersRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/owner/tasks': { id: '/_authenticated/owner/tasks'; path: '/owner/tasks'; fullPath: '/owner/tasks'; preLoaderRoute: typeof AuthenticatedOwnerTasksRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/owner/fraud': { id: '/_authenticated/owner/fraud'; path: '/owner/fraud'; fullPath: '/owner/fraud'; preLoaderRoute: typeof AuthenticatedOwnerFraudRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/owner/analytics': { id: '/_authenticated/owner/analytics'; path: '/owner/analytics'; fullPath: '/owner/analytics'; preLoaderRoute: typeof AuthenticatedOwnerAnalyticsRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/owner/settings': { id: '/_authenticated/owner/settings'; path: '/owner/settings'; fullPath: '/owner/settings'; preLoaderRoute: typeof AuthenticatedOwnerSettingsRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/owner/tickets': { id: '/_authenticated/owner/tickets'; path: '/owner/tickets'; fullPath: '/owner/tickets'; preLoaderRoute: typeof AuthenticatedOwnerTicketsRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/owner/announce': { id: '/_authenticated/owner/announce'; path: '/owner/announce'; fullPath: '/owner/announce'; preLoaderRoute: typeof AuthenticatedOwnerAnnounceRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/tasks/': { id: '/_authenticated/tasks/'; path: '/tasks'; fullPath: '/tasks/'; preLoaderRoute: typeof AuthenticatedTasksIndexRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
    '/_authenticated/tasks/$taskId': { id: '/_authenticated/tasks/$taskId'; path: '/tasks/$taskId'; fullPath: '/tasks/$taskId'; preLoaderRoute: typeof AuthenticatedTasksTaskIdRouteImport; parentRoute: typeof AuthenticatedRouteRoute }
  }
}

interface AuthenticatedRouteRouteChildren {
  AuthenticatedAdvertiseRoute: typeof AuthenticatedAdvertiseRoute
  AuthenticatedAmbassadorRoute: typeof AuthenticatedAmbassadorRoute
  AuthenticatedConnectedRoute: typeof AuthenticatedConnectedRoute
  AuthenticatedHomeRoute: typeof AuthenticatedHomeRoute
  AuthenticatedLeaderboardRoute: typeof AuthenticatedLeaderboardRoute
  AuthenticatedProfileRoute: typeof AuthenticatedProfileRoute
  AuthenticatedSupportRoute: typeof AuthenticatedSupportRoute
  AuthenticatedWalletRoute: typeof AuthenticatedWalletRoute
  AuthenticatedWatchEarnRoute: typeof AuthenticatedWatchEarnRoute
  AuthenticatedOwnerIndexRoute: typeof AuthenticatedOwnerIndexRoute
  AuthenticatedOwnerReviewsRoute: typeof AuthenticatedOwnerReviewsRoute
  AuthenticatedOwnerWithdrawalsRoute: typeof AuthenticatedOwnerWithdrawalsRoute
  AuthenticatedOwnerUsersRoute: typeof AuthenticatedOwnerUsersRoute
  AuthenticatedOwnerTasksRoute: typeof AuthenticatedOwnerTasksRoute
  AuthenticatedOwnerFraudRoute: typeof AuthenticatedOwnerFraudRoute
  AuthenticatedOwnerAnalyticsRoute: typeof AuthenticatedOwnerAnalyticsRoute
  AuthenticatedOwnerSettingsRoute: typeof AuthenticatedOwnerSettingsRoute
  AuthenticatedOwnerTicketsRoute: typeof AuthenticatedOwnerTicketsRoute
  AuthenticatedOwnerAnnounceRoute: typeof AuthenticatedOwnerAnnounceRoute
  AuthenticatedTasksIndexRoute: typeof AuthenticatedTasksIndexRoute
  AuthenticatedTasksTaskIdRoute: typeof AuthenticatedTasksTaskIdRoute
}

const AuthenticatedRouteRouteChildren: AuthenticatedRouteRouteChildren = {
  AuthenticatedAdvertiseRoute,
  AuthenticatedAmbassadorRoute,
  AuthenticatedConnectedRoute,
  AuthenticatedHomeRoute,
  AuthenticatedLeaderboardRoute,
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
  AuthenticatedTasksIndexRoute,
  AuthenticatedTasksTaskIdRoute,
}

const AuthenticatedRouteRouteWithChildren = AuthenticatedRouteRoute._addFileChildren(AuthenticatedRouteRouteChildren)

const rootRouteChildren: RootRouteChildren = {
  IndexRoute,
  AuthRoute,
  TelegramGateRoute,
  AuthenticatedRouteRoute: AuthenticatedRouteRouteWithChildren,
}

export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
    config: Awaited<ReturnType<typeof startInstance.getOptions>>
  }
}

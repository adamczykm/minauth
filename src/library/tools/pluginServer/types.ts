import { Logger, PluginRuntimeEnv } from '@lib/plugin';
import { Configuration } from './config';
import { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';
import { PluginRuntime } from '@lib/plugin/fp/pluginRuntime';
import { pipe } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as expressCore from 'express-serve-static-core';
import { tryCatchIO } from '@utils/fp/ReaderTaskEither';

export type PluginServerEnv = Readonly<{
  config: Configuration;
  rootLogger: Logger;
  pluginRuntimeEnv: PluginRuntimeEnv;
  expressApp: expressCore.Express;
}>;

export type PluginServer<Ret> = ReaderTaskEither<PluginServerEnv, string, Ret>;

export const liftPluginRuntime = <Ret>(
  a: PluginRuntime<Ret>
): PluginServer<Ret> =>
  pipe(
    askPluginRuntimeEnv(),
    RTE.chain((pluginRuntimeEnv) => RTE.fromTaskEither(a(pluginRuntimeEnv)))
  );

export const useRootLogger = (
  f: (logger: Logger) => void
): PluginServer<void> =>
  pipe(
    RTE.asks(({ rootLogger }: PluginServerEnv) => rootLogger),
    RTE.chain((rootLogger) => RTE.fromIO(() => f(rootLogger)))
  );

export const askRootLogger = (): PluginServer<Logger> =>
  RTE.asks(({ rootLogger }: PluginServerEnv) => rootLogger);

export const askPluginRuntimeEnv = (): PluginServer<PluginRuntimeEnv> =>
  RTE.asks(({ pluginRuntimeEnv }: PluginServerEnv) => pluginRuntimeEnv);

export const useExpressApp = (
  f: (app: expressCore.Express) => void
): PluginServer<void> =>
  withExpressApp((expressApp) =>
    tryCatchIO(
      () => f(expressApp),
      (err) => `error occurred while configuring express app: ${err}`
    )
  );

export const withExpressApp = <Ret>(
  f: (app: expressCore.Express) => PluginServer<Ret>
): PluginServer<Ret> =>
  pipe(
    askExpressApp(),
    RTE.chain((expressApp) => f(expressApp))
  );

export const askExpressApp = (): PluginServer<expressCore.Express> =>
  RTE.asks(({ expressApp }: PluginServerEnv) => expressApp);

export const askConfig = (): PluginServer<Configuration> =>
  RTE.asks(({ config }: PluginServerEnv) => config);

import { PluginRuntimeEnv } from '@server/pluginruntime';
import bodyParser from 'body-parser';
import * as expressCore from 'express-serve-static-core';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { JsonProof } from 'o1js';
import { z } from 'zod';
import {
  PluginServer,
  askConfig,
  askPluginRuntimeEnv,
  askRootLogger,
  liftPluginRuntime,
  useExpressApp,
  useRootLogger,
  withExpressApp
} from './types';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { wrapTrivialExpressHandler } from '@plugin/express';
import { launchTE, liftZodParseResult } from '@utils/fp/taskeither';
import {
  installCustomRoutes,
  validateOutput,
  verifyProof
} from '@server/plugin-fp-api';
import { OutputValidity } from '@plugin/plugintype';

interface VerifyProofData {
  plugin: string;
  publicInputArgs: unknown;
  proof: JsonProof;
}

/** Handle a POST request to /verifyProof */
const handleVerifyProof = (env: PluginRuntimeEnv) =>
  wrapTrivialExpressHandler((req) => {
    const body = req.body as VerifyProofData;
    return pipe(
      verifyProof(body.proof, body.publicInputArgs, body.plugin)(env),
      TE.map((output) => {
        return { output };
      }),
      TE.mapLeft(() => 'unknown error')
    );
  });

const validateOutputDataSchema = z.object({
  plugin: z.string(),
  output: z.unknown()
});

type ValidateOutputData = z.infer<typeof validateOutputDataSchema>;

/** Handle a POST request to /validateOutput */
const handleValidateOutput =
  (env: PluginRuntimeEnv) =>
  async (req: expressCore.Request, resp: expressCore.Response): Promise<void> =>
    launchTE(
      pipe(
        liftZodParseResult(validateOutputDataSchema.safeParse(req.body)),
        TE.chain((body: ValidateOutputData) =>
          validateOutput(body.plugin, body.output)(env)
        ),
        TE.tapIO(
          (val: OutputValidity) => () =>
            val.isValid
              ? resp.status(200).json({})
              : resp.status(400).json({ message: val.reason })
        ),
        TE.asUnit
      )
    );

/**
 * Install the basic routes for the plugin server:
 * - POST /verifyProof
 * - POST /validateOutput
 * - GET /health
 */
const installBasicRoutes = (): PluginServer<void> =>
  pipe(
    askPluginRuntimeEnv(),
    RTE.chain((env) =>
      useExpressApp((app) =>
        app
          .use(bodyParser.json())
          .post('/verifyProof', handleVerifyProof(env))
          .post('/validateOutput', handleValidateOutput(env))
          .get('/health', (_, resp) => resp.status(200).json({}))
      )
    )
  );

/**
 * If a request is not handled by any of the routes above,
 * Return a 404 error and 500 if an error occurs.
 */
const installFallbackHandlers = (): PluginServer<void> =>
  pipe(
    askRootLogger(),
    RTE.chain((logger) =>
      useExpressApp((app) =>
        app
          .all('*', (_, resp) => resp.status(404).json({ error: 'bad route' }))
          .use(
            (
              err: unknown,
              _req: expressCore.Request,
              resp: expressCore.Response
            ) => {
              logger.error('encountered unhandled express error', err);
              resp.status(500).json({ error: 'internal server error' });
            }
          )
      )
    )
  );

/**
 * Plugins can define their own routes to communicate with provers.
 */
const installPluginCustomRoutes = (): PluginServer<void> =>
  pipe(
    useRootLogger((logger) =>
      logger.info('installing custom routes for plugins')
    ),
    RTE.chain(() =>
      withExpressApp((app) => liftPluginRuntime(installCustomRoutes(app)))
    )
  );

export const setupAllRoutes = (): PluginServer<void> =>
  pipe(
    useExpressApp((app) => app.use(bodyParser.json())),
    RTE.chain(installPluginCustomRoutes),
    RTE.chain(installBasicRoutes),
    RTE.chain(installFallbackHandlers),
    RTE.asUnit
  );

/**
 * Calls app.listen() to start serving the plugin server
 * the configuration is read from the plugin server environment
 */
export const startServing = (): PluginServer<void> =>
  pipe(
    RTE.Do,
    RTE.bind('logger', askRootLogger),
    RTE.bind('cfg', askConfig),
    RTE.chain(({ logger, cfg }) =>
      useExpressApp((app) =>
        app.listen(cfg.port, cfg.address, () =>
          logger.info(`server is running on http://${cfg.address}:${cfg.port}`)
        )
      )
    )
  );

import { TaskEither } from 'fp-ts/lib/TaskEither';
import { ActivePlugins, UntypedPluginInstance } from './pluginLoader';
import * as expressCore from 'express-serve-static-core';
import {
  fromFailableIO,
  fromFailablePromise,
  liftZodParseResult
} from '@utils/fp/TaskEither';
import * as R from 'fp-ts/Record';
import * as TE from 'fp-ts/TaskEither';
import { RequestHandler } from 'express';
import { pipe } from 'fp-ts/lib/function';
import { JsonProof, verify } from 'o1js';

export const installCustomRoutes =
  (activePlugins: ActivePlugins) =>
  (app: expressCore.Express): TaskEither<string, void> =>
    pipe(
      R.traverseWithIndex(TE.ApplicativeSeq)(
        (pluginName, pluginInstance: UntypedPluginInstance) =>
          R.traverseWithIndex(TE.ApplicativeSeq)(
            (path, handler: RequestHandler) =>
              fromFailableIO(
                () => app.use(`/plugins/${pluginName}/${path}`, handler),
                `failed to install custom route ${path} for plugin ${pluginName}`
              )
          )(pluginInstance.customRoutes)
      )(activePlugins),
      TE.map(() => {})
    );

export const verifyProof =
  (activePlugins: ActivePlugins) =>
  (
    proof: JsonProof,
    publicInputArgs: unknown,
    pluginName: string
  ): TaskEither<string, unknown> =>
    pipe(
      TE.Do,
      TE.tap(() =>
        TE.fromIO(() =>
          console.info(`verifying proof using plugin ${pluginName}`)
        )
      ),
      TE.bind('pluginInstance', () =>
        TE.fromOption(() => `plugin ${pluginName} not found`)(
          R.lookup(pluginName)(activePlugins)
        )
      ),
      // Step 1: check that the proof was generated using a certain verification key.
      TE.tap(({ pluginInstance }) =>
        pipe(
          fromFailablePromise(
            () => verify(proof, pluginInstance.verificationKey),
            'unable to verify proof'
          ),
          TE.tap((valid) =>
            valid ? TE.right(undefined) : TE.left('invalid proof')
          )
        )
      ),
      // Step 2: use the plugin to extract the output. The plugin is also responsible
      // for checking the legitimacy of the public inputs.
      TE.bind('typedPublicInputArgs', ({ pluginInstance }) =>
        liftZodParseResult(
          pluginInstance.publicInputArgsSchema.safeParse(publicInputArgs)
        )
      ),
      TE.chain(({ typedPublicInputArgs, pluginInstance }) =>
        pluginInstance.verifyAndGetOutput(typedPublicInputArgs, proof)
      )
    );

// TODO: utilities to run provers
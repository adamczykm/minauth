import { Cache, JsonProof, verify } from 'o1js';
import {
  IMinAuthPlugin,
  IMinAuthPluginFactory,
  OutputValidity,
  outputInvalid,
  outputValid
} from 'minauth/plugin/plugintype';
import ProvePreimageProgram, {
  ProvePreimageProofClass
} from './hash-preimage-proof';
import { Router } from 'express';
import { z } from 'zod';
import { TsInterfaceType } from 'minauth/plugin/interfacekind';
import * as fs from 'fs/promises';
import {
  wrapZodDec,
  combineEncDec,
  noOpEncoder
} from 'minauth/plugin/encodedecoder';
import { Logger } from 'minauth/plugin/logger';

/**
 * The plugin configuration schema.
 */
export const configurationSchema = z
  .object({
    roles: z.record(
      // FIXME: the key should be a valid poseidon hash
      /** Hash preimage of which is used to authorize operations */
      z.string(),
      /** An auxilliary name for the hash - for example
       *  a name of a role in the system */
      z.string()
    )
  })
  .or(
    z.object({
      /** Alternatively, the "roles" can be loaded from a file */
      loadRolesFrom: z.string()
    })
  );

export type Configuration = z.infer<typeof configurationSchema>;

/**
 * The output of the plugin is the hash that the preimage knowledge of which
 * was proven and a role assigned to that hash
 */
export type Output = {
  provedHash: string;
  role: string;
};

/**
 * Somewhat trivial example of a plugin.
 * The plugin keeps a fixed set of hashes.
 * Each hash is associated with a role in the system.
 * One can prove that they have the role by providing the secret
 * preimage of the hash.
 *
 * NOTE. Although one can always generate valid zkproof its output must
 *       match the list kept by the server.
 */
export class SimplePreimagePlugin
  implements IMinAuthPlugin<TsInterfaceType, unknown, Output>
{
  /**
   * This plugin uses an idiomatic Typescript interface
   */
  readonly __interface_tag = 'ts';

  /**
   *  A memoized zk-circuit verification key
   */
  readonly verificationKey: string;

  /**
   *  The mapping between hashes and role
   */
  private readonly roles: Record<string, string>;

  /** The plugin's logger */
  private readonly logger: Logger;

  /**
   * Verify a proof and return the role.
   */
  async verifyAndGetOutput(
    _: unknown,
    serializedProof: JsonProof
  ): Promise<Output> {
    const proof = ProvePreimageProofClass.fromJSON(serializedProof);
    const key = proof.publicOutput.toString();
    const role = this.roles[key]; // Directly accessing the property in the record

    if (role === undefined) {
      throw new Error('unable to find role');
    }

    this.logger.debug('Proof verification...');
    const valid = await verify(proof, this.verificationKey);
    if (!valid) {
      this.logger.info('Proof verification failed.');
      throw new Error('Invalid proof!');
    }
    this.logger.info('Proof verification succeeded.');

    return { provedHash: key, role };
  }

  /**
   * Trivial - no public inputs.
   */
  publicInputArgsSchema: z.ZodType<unknown> = z.any();

  /**
   * Provide an endpoint returning a list of roles recognized by the plugin.
   */
  readonly customRoutes = Router().get('/roles', (_, res) =>
    res.status(200).json(this.roles)
  );

  /**
   * Check if produced output is still valid. If the roles dictionary was edited
   * it may become invalid. Notice that the proof and output consumer must not
   * allow  output forgery as this will accept forged outputs without verification.
   * To prevent it the plugin could take the reponsibility by having a cache of outputs
   * with unique identifiers.
   */
  async checkOutputValidity(output: Output): Promise<OutputValidity> {
    if (!this.roles.hasOwnProperty(output.provedHash)) {
      return Promise.resolve(outputInvalid('Proved hash is no longer valid.'));
    }
    if (this.roles[output.provedHash] !== output.role) {
      return Promise.resolve(
        outputInvalid('The role assigned to the hash is no longer valid.')
      );
    }
    return Promise.resolve(outputValid);
  }

  /**
   * This ctor is meant ot be called by the `initialize` function.
   */
  constructor(
    verificationKey: string,
    roles: Record<string, string>,
    logger: Logger
  ) {
    this.verificationKey = verificationKey;
    this.roles = roles;
    this.logger = logger;
  }

  static readonly __interface_tag = 'ts';

  /**
   * Initialize the plugin with a configuration.
   */
  static async initialize(
    configuration: Configuration,
    logger: Logger
  ): Promise<SimplePreimagePlugin> {
    const { verificationKey } = await ProvePreimageProgram.compile({
      cache: Cache.None
    });
    const roles =
      'roles' in configuration
        ? configuration.roles
        : await fs
            .readFile(configuration.loadRolesFrom, 'utf-8')
            .then(JSON.parse);
    return new SimplePreimagePlugin(verificationKey, roles, logger);
  }

  static readonly configurationDec = wrapZodDec('ts', configurationSchema);

  static readonly publicInputArgsDec = wrapZodDec('ts', z.unknown());

  /** output parsing and serialization */
  static readonly outputEncDec = combineEncDec(
    noOpEncoder('ts'),
    wrapZodDec('ts', z.object({ provedHash: z.string(), role: z.string() }))
  );
}

// sanity check
SimplePreimagePlugin satisfies IMinAuthPluginFactory<
  TsInterfaceType,
  SimplePreimagePlugin,
  Configuration
>;

export default SimplePreimagePlugin;
import { JsonProof } from 'o1js';
import {
  IMinAuthPlugin,
  IMinAuthPluginFactory,
  TsInterfaceType
} from '@lib/plugin';
import ProvePreimageProgram, {
  ProvePreimageProofClass
} from '../common/hashPreimageProof';
import { RequestHandler } from 'express';
import { z } from 'zod';
import * as R from 'fp-ts/Record';
import * as O from 'fp-ts/Option';

export class SimplePreimagePlugin
  implements IMinAuthPlugin<TsInterfaceType, unknown, string>
{
  readonly __interface_tag = 'ts';

  readonly verificationKey: string;
  private readonly roles: Record<string, string>;

  async verifyAndGetOutput(
    _: unknown,
    serializedProof: JsonProof
  ): Promise<string> {
    const proof = ProvePreimageProofClass.fromJSON(serializedProof);
    const ret = R.lookup(proof.publicOutput.toString())(this.roles);
    if (O.isNone(ret)) throw 'unable to find role';
    else return ret.value;
  }

  publicInputArgsSchema: z.ZodType<unknown> = z.any();

  customRoutes: Record<string, RequestHandler> = {
    '/roles': (req, res) => {
      if (req.method != 'GET')
        res.status(400).json({ error: 'bad request method' });
      res.status(200).json(this.roles);
    }
  };

  constructor(verificationKey: string, roles: Record<string, string>) {
    this.verificationKey = verificationKey;
    this.roles = roles;
  }

  static readonly __interface_tag = 'ts';

  static async initialize(configuration: {
    roles: Record<string, string>;
  }): Promise<SimplePreimagePlugin> {
    const { verificationKey } = await ProvePreimageProgram.compile();
    return new SimplePreimagePlugin(verificationKey, configuration.roles);
  }

  static readonly configurationSchema: z.ZodType<{
    roles: Record<string, string>;
  }> = z.object({
    roles: z.record(
      // FIXME: the key should be a valid poseidon hash
      z.string(),
      z.string()
    )
  });
}

// sanity check
SimplePreimagePlugin satisfies IMinAuthPluginFactory<
  SimplePreimagePlugin,
  TsInterfaceType,
  { roles: Record<string, string> },
  unknown,
  string
>;

export default SimplePreimagePlugin;

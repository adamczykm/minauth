import * as cmd from 'cmd-ts';
import { UntypedProofGeneratorFactory } from '../ProofGenerator';
import SimplePreImageGenerator from '../proofGenerators/SimplePreimageGenerator';
import MerkleMembershipsGenerator from '../proofGenerators/MerkleMembershipsGenerator';
import * as R from 'fp-ts/Record';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/lib/function';
import * as fs from 'fs/promises';
import { commonOptions } from './common';
import { Client } from '../client';

export const args = {
  ...commonOptions,
  proofGeneratorName: cmd.option({
    long: 'proof-generator-name',
    short: 'g',
    type: cmd.string
  }),
  proofGeneratorConfFile: cmd.option({
    long: 'proof-generator-conf-file',
    short: 'c',
    type: cmd.string
  })
};

const proofGenerators: Record<string, UntypedProofGeneratorFactory> = {
  SimplePreimage: SimplePreImageGenerator,
  MerkleMembership: MerkleMembershipsGenerator
};

export const handler = async (cfg: {
  serverUrl: string;
  jwtFile: string;
  refreshTokenFile: string;
  proofGeneratorName: string;
  proofGeneratorConfFile: string;
}) => {
  const client = new Client(cfg.serverUrl);
  const generatorFactory = await pipe(
    R.lookup(cfg.proofGeneratorName)(proofGenerators),
    O.match(
      () => Promise.reject(`unknown generator ${cfg.proofGeneratorName}`),
      Promise.resolve<UntypedProofGeneratorFactory>
    )
  );
  const generatorConf = fs
    .readFile(cfg.proofGeneratorConfFile, 'utf-8')
    .then(JSON.parse)
    .then(generatorFactory.confSchema.parse);
  const generate = generatorFactory.mkGenerator(generatorConf);
  const proof = await generate();
  const loginResult = await client.login(proof);
  await fs.writeFile(cfg.jwtFile, loginResult.token);
  await fs.writeFile(cfg.refreshTokenFile, loginResult.refreshToken);
};

export const command = cmd.command({
  name: 'login',
  args,
  handler
});

export default command;
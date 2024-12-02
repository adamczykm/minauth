import {
  Field,
  MerkleWitness,
  Poseidon,
  SelfProof,
  Struct,
  ZkProgram
} from 'o1js';

// TODO how can this be made dynamic
export const TREE_HEIGHT = 10;

export class TreeWitness extends MerkleWitness(TREE_HEIGHT) {}

export class PrivateInput extends Struct({
  witness: TreeWitness,
  secret: Field
}) {}

export class PublicInput extends Struct({
  merkleRoot: Field
}) {}

export class PublicOutput extends Struct({
  recursiveHash: Field
}) {}

/** Prove knowledge of a preimage of a hash in a merkle tree.
 *  The proof does not reveal the preimage nor the hash.
 *  The output contains a recursive hash of all the roots for which the preimage is known.
 *  output = hash(lastRoot + hash(secondLastRoot, ... hash(xLastRoot, lastRoot) ...)
 *  Therefore the order of the proofs matters.
 */
export const Program = ZkProgram({
  name: 'MerkleMemberships',
  publicInput: PublicInput,
  publicOutput: PublicOutput,

  methods: {
    baseCase: {
      privateInputs: [PrivateInput],
      async method(
        publicInput: PublicInput,
        privateInput: PrivateInput
      ) {
        privateInput.witness
          .calculateRoot(Poseidon.hash([privateInput.secret]))
          .assertEquals(publicInput.merkleRoot);
        let publicOutput = new PublicOutput({
          recursiveHash: publicInput.merkleRoot
        });

        return {publicOutput};
      }
    },

    inductiveCase: {
      privateInputs: [SelfProof, PrivateInput],
      async method(
        publicInput: PublicInput,
        earlierProof: SelfProof<PublicInput, PublicOutput>,
        privateInput: PrivateInput
      ) {
        earlierProof.verify();
        privateInput.witness
          .calculateRoot(Poseidon.hash([privateInput.secret]))
          .assertEquals(publicInput.merkleRoot);
        let publicOutput = new PublicOutput({
          recursiveHash: Poseidon.hash([
            publicInput.merkleRoot,
            earlierProof.publicOutput.recursiveHash
          ])});
        return {publicOutput};
      }
    }
  }
});

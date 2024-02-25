/**
 * Represents the response from an authentication request, encapsulating the status
 * and message related to the authentication process, along with a method for serialization.
 */
export interface IsAuthResponse {
  /** Indicates the level of authentication achieved.
   *  - `'full'` indicates that the all the plugins have authenticated the user.
   *  - `'partial'` indicates that some of the plugins have authenticated the user.
   *  - `'none'` indicates that none of the plugins have authenticated the user.
   */
  authStatus: 'full' | 'partial' | 'none';

  /** A descriptive message providing details about the authentication process or its outcome. */
  authMessage: string;

  /**
   * Returns a serialized representation of the authentication response.
   * @returns The serialized form of the auth response.
   */
  serialized(): unknown;
}

/**
 * Defines the structure for an authentication mapper, responsible for handling
 * authentication processes, including requesting authentication, validating responses,
 * and extracting information necessary for validity checks.
 *
 * @template AuthResponse The type of the authentication response.
 * @template AuthResponseValidityCheck The type used for checking the validity of an auth response.
 * @template AuthValidityReport The type representing the outcome of the validity check.
 */
export interface IAuthMapper<
  AuthResponse extends IsAuthResponse,
  AuthResponseValidityCheck,
  AuthValidityReport
> {
  /**
   * Asynchronously requests authentication based on the provided request body.
   * @param authRequestBody The request body for the authentication request.
   * @returns A promise resolving to an `AuthResponse`.
   */
  requestAuth(authRequestBody: unknown): Promise<AuthResponse>;

  /**
   * Asynchronously checks the validity of an authentication response.
   * @param authResponse The response to validate.
   * @returns A promise resolving to an `AuthValidityReport`.
   */
  checkAuthValidity(
    authResponse: AuthResponseValidityCheck
  ): Promise<AuthValidityReport>;

  /**
   * Extracts necessary information from an `AuthResponse` to perform a validity check.
   * @param authResponse The authentication response.
   * @returns The extracted information necessary for the validity check.
   */
  extractValidityCheck(authResponse: AuthResponse): AuthResponseValidityCheck;
}

/**
 * Transforms the result of the `checkAuthValidity` method of an `IAuthMapper` instance,
 * allowing for the transformation of the validity report into a new type.
 *
 * @template T The type of the authentication response, extending `IsAuthResponse`.
 * @template A The original type of the validity report generated by `checkAuthValidity`.
 * @template V The type of the input to `checkAuthValidity`.
 * @template B The new type for the validity report after transformation.
 * @param authMapper An instance of `IAuthMapper`.
 * @param f A function that transforms a value of type `A` into a `Promise<B>`.
 * @returns An `IAuthMapper` instance with transformed `checkAuthValidity` output.
 */
export const mapValidityReport = <T extends IsAuthResponse, A, V, B>(
  authMapper: IAuthMapper<T, V, A>,
  f: (a: A) => Promise<B>
): IAuthMapper<T, V, B> => {
  return {
    extractValidityCheck: authMapper.extractValidityCheck,
    requestAuth: authMapper.requestAuth,
    checkAuthValidity: (input: V): Promise<B> => {
      return authMapper.checkAuthValidity(input).then(f);
    }
  };
};

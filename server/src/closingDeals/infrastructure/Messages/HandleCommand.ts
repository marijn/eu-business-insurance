import * as Either from "fp-ts/Either";

export type PromiseToHandleCommandOf<
    CommandHandlingError extends ErrorMessage,
    Command extends { _named: string }
> = (command: Command) => Promise<Either.Either<CommandHandlingError, void>>

export type ErrorMessage = {
    externalErrorMessage: string,
    developerErrorMessage: string,
};

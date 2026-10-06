import { isClerkAPIResponseError, useSignIn } from "@clerk/clerk-expo"
import React from "react"
import { useReportError } from "@/src/hooks/useReportError/useReportError"

export type SecondFactorStrategy =
  | "email_code"
  | "phone_code"
  | "totp"
  | "backup_code"

// Preferred order when the account has several second factors.
const SECOND_FACTOR_PREFERENCE: SecondFactorStrategy[] = [
  "email_code",
  "phone_code",
  "totp",
  "backup_code",
]

type SupportedSecondFactor = {
  strategy: string
  emailAddressId?: string
  phoneNumberId?: string
  safeIdentifier?: string
}

type UseSignInFormReturn = {
  emailAddress: string
  setEmailAddress: (value: string) => void
  password: string
  setPassword: (value: string) => void
  errors: string[] | null
  onSignInPress: () => Promise<void>
  isSigningIn: boolean
  needsSecondFactor: boolean
  secondFactorStrategy: SecondFactorStrategy | null
  secondFactorDestination: string | null
  secondFactorCode: string
  setSecondFactorCode: (value: string) => void
  onSecondFactorPress: () => Promise<void>
  isVerifyingSecondFactor: boolean
}

// Clerk's own message for the user (wrong password, unknown account, locked,
// rate limited, ...) or `fallback` for anything unexpected.
function getClerkErrorMessages(err: unknown, fallback: string): string[] {
  if (isClerkAPIResponseError(err) && err.errors?.length) {
    return err.errors.map((e) => e.longMessage || e.message || fallback)
  }
  return [fallback]
}

function pickSecondFactor(
  factors: SupportedSecondFactor[] | null | undefined,
): SupportedSecondFactor | null {
  for (const strategy of SECOND_FACTOR_PREFERENCE) {
    const factor = factors?.find((f) => f.strategy === strategy)
    if (factor) {
      return factor
    }
  }
  return null
}

const UNSUPPORTED_STATUS_MESSAGE =
  "Additional verification is required to sign in to this account. Please try another sign-in method or contact support."

export function useSignInForm(): UseSignInFormReturn {
  const { signIn, setActive, isLoaded } = useSignIn()
  const [errors, setErrors] = React.useState<string[] | null>(null)
  const [isSigningIn, setIsSigningIn] = React.useState(false)
  const [needsSecondFactor, setNeedsSecondFactor] = React.useState(false)
  const [secondFactorStrategy, setSecondFactorStrategy] =
    React.useState<SecondFactorStrategy | null>(null)
  const [secondFactorDestination, setSecondFactorDestination] = React.useState<
    string | null
  >(null)
  const [secondFactorCode, setSecondFactorCode] = React.useState("")
  const [isVerifyingSecondFactor, setIsVerifyingSecondFactor] =
    React.useState(false)
  const { report } = useReportError()

  const [emailAddress, setEmailAddress] = React.useState("")
  const [password, setPassword] = React.useState("")

  // Handle the submission of the sign-in form
  const onSignInPress = async () => {
    setErrors(null)
    setIsSigningIn(true)

    if (!isLoaded) {
      setIsSigningIn(false)
      return
    }

    // Start the sign-in process using the email and password provided
    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      })

      // If sign-in process is complete, set the created session as active
      // and redirect the user
      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId })
      } else if (signInAttempt.status === "needs_second_factor") {
        const factor = pickSecondFactor(signInAttempt.supportedSecondFactors)
        if (!factor) {
          report(
            new Error(
              `Unsupported second factors: ${JSON.stringify(
                signInAttempt.supportedSecondFactors?.map((f) => f.strategy),
              )}`,
            ),
          )
          setErrors([UNSUPPORTED_STATUS_MESSAGE])
          return
        }

        const strategy = factor.strategy as SecondFactorStrategy
        // Code-delivery factors need a code sent first; TOTP / backup codes
        // come from the user's authenticator app or saved codes.
        if (strategy === "email_code") {
          await signIn.prepareSecondFactor({
            strategy,
            emailAddressId: factor.emailAddressId,
          })
        } else if (strategy === "phone_code") {
          await signIn.prepareSecondFactor({
            strategy,
            phoneNumberId: factor.phoneNumberId,
          })
        }
        setSecondFactorStrategy(strategy)
        setSecondFactorDestination(factor.safeIdentifier ?? null)
        setSecondFactorCode("")
        setNeedsSecondFactor(true)
      } else {
        // needs_first_factor / needs_new_password / needs_identifier: flows
        // this form doesn't support. Tell the user instead of doing nothing.
        report(new Error(`Unhandled sign-in status: ${signInAttempt.status}`))
        setErrors([UNSUPPORTED_STATUS_MESSAGE])
      }
    } catch (err) {
      // Clerk API errors are user errors (wrong password, ...): show them,
      // don't send them to Sentry. Anything else is unexpected.
      if (!isClerkAPIResponseError(err)) {
        report(err)
      }
      setErrors(getClerkErrorMessages(err, "Invalid email or password."))
    } finally {
      setIsSigningIn(false)
    }
  }

  // Handle the submission of the second factor code
  const onSecondFactorPress = async () => {
    setErrors(null)
    setIsVerifyingSecondFactor(true)

    if (!isLoaded || !secondFactorStrategy) {
      setIsVerifyingSecondFactor(false)
      return
    }

    try {
      const signInAttempt = await signIn.attemptSecondFactor({
        strategy: secondFactorStrategy,
        code: secondFactorCode.trim(),
      })

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId })
      } else {
        report(new Error(`Unhandled 2FA status: ${signInAttempt.status}`))
        setErrors([UNSUPPORTED_STATUS_MESSAGE])
      }
    } catch (err) {
      if (!isClerkAPIResponseError(err)) {
        report(err)
      }
      setErrors(getClerkErrorMessages(err, "Invalid verification code."))
    } finally {
      setIsVerifyingSecondFactor(false)
    }
  }

  return {
    emailAddress,
    setEmailAddress,
    password,
    setPassword,
    errors,
    onSignInPress,
    isSigningIn,
    needsSecondFactor,
    secondFactorStrategy,
    secondFactorDestination,
    secondFactorCode,
    setSecondFactorCode,
    onSecondFactorPress,
    isVerifyingSecondFactor,
  }
}

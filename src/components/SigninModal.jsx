import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ModalAnimation from './ModalAnimation'
import { sendPasswordReset, signInWithPassword, signUpWithPassword, startGoogleSignIn, updatePassword } from '../lib/Supabase'
import { copyText, notify } from '../lib/Notifications'

const loginScope = { 'data-v-6f5ded14': '' }
const credentialsScope = { 'data-v-2e006020': '' }
const forgotScope = { 'data-v-8f8dae4c': '' }
const robloxScope = { 'data-v-3b09fc0c': '' }
const modalScope = { 'data-v-119d36d9': '' }

function GoogleIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" /><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" /><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" /><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" /></svg>
}

function RobloxIcon() {
  return <svg className="roblox-icon" xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none" {...credentialsScope}><path d="M11.6763 0L0 44.1659L43.5771 56L55.2533 11.8341L11.6763 0ZM32.0849 35.827L19.9079 32.5185L23.1723 20.1769L35.3542 23.4855L32.0849 35.827Z" fill="currentColor" /></svg>
}

function SocialButtons({ onRoblox }) {
  const handleGoogle = async () => {
    try {
      await startGoogleSignIn()
    } catch (error) {
      notify({ type: 'error', message: error.message || 'Google sign in failed. Please try again.' })
    }
  }
  return <><div className="social-divider" {...credentialsScope}>or</div><div className="social-buttons" {...credentialsScope}><button className="button-social google" type="button" onClick={handleGoogle} {...credentialsScope}><GoogleIcon /> Continue with Google</button><button className="button-social roblox" type="button" onClick={onRoblox} {...credentialsScope}><RobloxIcon /> Continue with Roblox</button></div></>
}

function LoginForm({ setTab, onAuthenticated }) {
  const [loading, setLoading] = useState(false)
  const signIn = async () => {
    const password = document.getElementById('loginPassword')?.value || ''
    const email = document.getElementById('loginInfo')?.value.trim() || ''
    if (!password.trim()) return notify({ type: 'error', message: 'Your entered password is invalid.' })
    if (!email || !email.includes('@')) return notify({ type: 'error', message: 'Please enter the email address for your account.' })
    setLoading(true)
    try {
      const user = await signInWithPassword(email, password)
      notify({ type: 'success', message: 'Signed in successfully!' })
      onAuthenticated?.(user)
    } catch (error) {
      notify({ type: 'error', message: error.message || 'Your entered username or password is invalid.' })
    } finally {
      setLoading(false)
    }
  }
  return <div className="form-view auth-form-transition" {...credentialsScope}><div className="form-content" {...credentialsScope}><form className="credentials-form" onSubmit={(event) => { event.preventDefault(); signIn() }} {...credentialsScope}><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="loginInfo" {...credentialsScope}>Email or Username</label><div className="element-input" {...credentialsScope}><input id="loginInfo" type="text" placeholder="Enter your email or username" autoComplete="username" required {...credentialsScope} /></div></div><div className="credentials-element" {...credentialsScope}><div className="element-label-group" {...credentialsScope}><label className="element-title" htmlFor="loginPassword" {...credentialsScope}>Password</label><button className="button-forgot" type="button" onClick={() => setTab('forgot')} {...credentialsScope}><span {...credentialsScope}>Forgot Password?</span></button></div><div className="element-input" {...credentialsScope}><input id="loginPassword" type="password" placeholder="Enter your password" autoComplete="current-password" required {...credentialsScope} /></div></div></form></div><div className="action-section" {...credentialsScope}><button className="button-action" type="button" disabled={loading} onClick={signIn} {...credentialsScope}>{loading ? 'Signing In...' : 'Sign In'}</button><SocialButtons onRoblox={() => setTab('roblox')} /><div className="switch-view" {...credentialsScope}>Don't have an account? <span onClick={() => setTab('register')} role="button" tabIndex="0" {...credentialsScope}>Sign Up</span></div></div></div>
}

function RegisterForm({ setTab, onAuthenticated }) {
  const [agree, setAgree] = useState(false)
  const [age, setAge] = useState(false)
  const [loading, setLoading] = useState(false)
  const signUp = async () => {
    const password = document.getElementById('password')?.value || ''
    const confirmation = document.getElementById('passwordConfirm')?.value || ''
    const username = document.getElementById('username')?.value.trim() || ''
    const email = document.getElementById('email')?.value.trim() || ''
    if (!password.trim()) return notify({ type: 'error', message: 'Your entered password is invalid.' })
    if (password !== confirmation) return notify({ type: 'error', message: 'Your passwords do not match.' })
    if (!username) return notify({ type: 'error', message: 'Your entered username is invalid.' })
    if (!email) return notify({ type: 'error', message: 'Your entered email is invalid.' })
    setLoading(true)
    try {
      const user = await signUpWithPassword({ username, email, password })
      if (user) {
        notify({ type: 'success', message: 'Registered successfully!' })
        onAuthenticated?.(user)
      } else {
        notify({ type: 'success', message: 'Check your email to confirm your account.' })
      }
    } catch (error) {
      notify({ type: 'error', message: error.message || 'Registration failed. Please try again.' })
    } finally {
      setLoading(false)
    }
  }
  return <div className="form-view auth-form-transition" {...credentialsScope}><div className="form-content" {...credentialsScope}><form className="credentials-form" onSubmit={(event) => { event.preventDefault(); signUp() }} {...credentialsScope}><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="username" {...credentialsScope}>Username</label><div className="element-input" {...credentialsScope}><input id="username" type="text" placeholder="Enter a username" minLength="3" maxLength="20" pattern="[A-Za-z0-9_]{3,20}" autoComplete="username" required {...credentialsScope} /></div></div><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="email" {...credentialsScope}>Email</label><div className="element-input" {...credentialsScope}><input id="email" type="email" placeholder="Enter your email address" autoComplete="email" required {...credentialsScope} /></div></div><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="password" {...credentialsScope}>Password</label><div className="element-input" {...credentialsScope}><input id="password" type="password" placeholder="Create a secure password" minLength="8" autoComplete="new-password" required {...credentialsScope} /></div></div><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="passwordConfirm" {...credentialsScope}>Password Confirm</label><div className="element-input" {...credentialsScope}><input id="passwordConfirm" type="password" placeholder="Re-enter your password" minLength="8" autoComplete="new-password" required {...credentialsScope} /></div></div><div className="credentials-checkboxes" {...credentialsScope}><div className="credentials-info" {...credentialsScope}><input className="checkbox-custom" type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} {...credentialsScope} /> I agree to the <a className="button-terms" href="/terms-of-service" {...credentialsScope}>Terms of Service</a></div><div className="credentials-info" {...credentialsScope}><input className="checkbox-custom" type="checkbox" checked={age} onChange={(event) => setAge(event.target.checked)} {...credentialsScope} /> I confirm that <span className="button-terms" {...credentialsScope}>I am at least 18 years old</span></div></div></form></div><div className="action-section" {...credentialsScope}><button className={`button-action${agree && age ? '' : ' button-action-disabled'}`} type="button" disabled={!agree || !age || loading} onClick={signUp} {...credentialsScope}>{loading ? 'Creating Account...' : 'Sign Up'}</button><SocialButtons onRoblox={() => setTab('roblox')} /><div className="switch-view" {...credentialsScope}>Already have an account? <span onClick={() => setTab('login')} role="button" tabIndex="0" {...credentialsScope}>Sign In</span></div></div></div>
}

function AlternateForm({ type, setTab }) {
  const isRoblox = type === 'roblox'
  return <div className="form-view auth-form-transition" {...credentialsScope}><div className="form-content" {...credentialsScope}><p className="auth-description">{isRoblox ? 'Log in with your Roblox username, then verify your account by putting a verification phrase in your Roblox bio.' : 'Enter your email address and we’ll send you instructions to reset your password.'}</p><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="alternateAuth" {...credentialsScope}>{isRoblox ? 'Roblox Username' : 'Email'}</label><div className="element-input" {...credentialsScope}><input id="alternateAuth" type={isRoblox ? 'text' : 'email'} placeholder={isRoblox ? 'Enter your Roblox username' : 'Enter your email address'} {...credentialsScope} /></div></div></div><div className="action-section" {...credentialsScope}><button className="button-action" type="button" {...credentialsScope}>{isRoblox ? 'Continue' : 'Send Reset Link'}</button><div className="switch-view" {...credentialsScope}><span onClick={() => setTab('login')} role="button" tabIndex="0" {...credentialsScope}>Back to Sign In</span></div></div></div>
}

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const sendLink = async () => {
    if (!isEmailValid || loading) return
    setLoading(true)
    try {
      await sendPasswordReset(email)
      notify({ type: 'success', message: 'Password reset link sent. Check your email.' })
    } catch (error) {
      notify({ type: 'error', message: error.message || 'Could not send the password reset link.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-forgot-password" {...forgotScope}>
      <div className="login-forgot" {...forgotScope}>
        <div className="forgot-header" {...forgotScope}>
          <h2 {...forgotScope}>Reset Password</h2>
          <p {...forgotScope}>Enter your email to receive a password reset link</p>
        </div>
        <div className="forgot-element" {...forgotScope}>
          <div className="element-input" {...forgotScope}>
            <input
              type="email"
              placeholder="Enter your email address"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              {...forgotScope}
            />
            <button className="button-reset" type="button" disabled={!isEmailValid || loading} onClick={sendLink} {...forgotScope}>
              <div className="button-inner" {...forgotScope}>
                <span {...forgotScope}>{loading ? 'Sending...' : 'Send Link'}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function HcaptchaBox({ onVerify, siteKey }) {
  const containerRef = useRef(null)

  useEffect(() => {
    let active = true
    let widgetId = null

    const renderCaptcha = () => {
      if (!active || !siteKey || !containerRef.current || !window.hcaptcha || containerRef.current.childElementCount > 0) return
      widgetId = window.hcaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': () => onVerify(null),
        'chalexpired-callback': () => onVerify(null),
      })
    }

    let script = document.querySelector('script[data-rorisk-hcaptcha]')
    if (!script) {
      script = document.createElement('script')
      script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.roriskHcaptcha = 'true'
      document.head.appendChild(script)
    }

    script.addEventListener('load', renderCaptcha)
    renderCaptcha()

    return () => {
      active = false
      script.removeEventListener('load', renderCaptcha)
      if (widgetId !== null && window.hcaptcha) window.hcaptcha.remove(widgetId)
    }
  }, [onVerify, siteKey])

  return siteKey ? <div ref={containerRef} {...robloxScope} /> : <p className="auth-inline-error">hCaptcha needs to be configured in .env.</p>
}

function UpdatePassword({ onComplete }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const valid = password.length >= 8 && password === confirmation

  const savePassword = async () => {
    if (!valid || loading) return
    setLoading(true)
    try {
      await updatePassword(password)
      notify({ type: 'success', message: 'Your password has been updated.' })
      onComplete?.()
    } catch (error) {
      notify({ type: 'error', message: error.message || 'Could not update your password.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-forgot-password" {...forgotScope}>
      <div className="login-forgot" {...forgotScope}>
        <div className="forgot-header" {...forgotScope}><h2 {...forgotScope}>Reset Password</h2><p {...forgotScope}>Enter a new password for your account</p></div>
        <div className="forgot-element" {...forgotScope}><div className="element-input" {...forgotScope}><input type="password" placeholder="Enter a new password" minLength="8" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} {...forgotScope} /></div></div>
        <div className="forgot-element" {...forgotScope}><div className="element-input" {...forgotScope}><input type="password" placeholder="Confirm your new password" minLength="8" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} {...forgotScope} /><button className="button-reset" type="button" disabled={!valid || loading} onClick={savePassword} {...forgotScope}><div className="button-inner" {...forgotScope}><span {...forgotScope}>{loading ? 'Saving...' : 'Update Password'}</span></div></button></div></div>
      </div>
    </div>
  )
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function RobloxForm({ setTab, onAuthenticated }) {
  const [username, setUsername] = useState('')
  const [agree, setAgree] = useState(false)
  const [age, setAge] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [siteKey, setSiteKey] = useState('')
  const [verification, setVerification] = useState(null)
  const [shownVerification, setShownVerification] = useState(null)
  const [remaining, setRemaining] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const stepRef = useRef(null)
  const stepTransitionRef = useRef(0)
  const stepEnteringRef = useRef(false)
  const canContinue = username.trim() && agree && age && captchaToken && !loading

  useEffect(() => {
    fetch('/api/auth/config').then((response) => response.json()).then((config) => setSiteKey(config.hcaptchaSiteKey || '')).catch(() => {})
  }, [])

  useEffect(() => {
    if (!verification) return undefined
    const update = () => setRemaining(verification.expiresAt - Date.now())
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [verification])

  useEffect(() => {
    if (verification === shownVerification) return undefined
    const element = stepRef.current?.firstElementChild
    if (!element) {
      setShownVerification(verification)
      return undefined
    }

    const transition = ++stepTransitionRef.current
    const height = element.scrollHeight
    const animation = element.animate([
      { height: `${height}px`, opacity: 1, transform: 'translateY(0)' },
      { height: '0px', opacity: 0, transform: 'translateY(80px)' },
    ], {
      duration: 400,
      easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
      fill: 'forwards',
    })

    animation.finished.then(() => {
      if (stepTransitionRef.current !== transition) return
      stepEnteringRef.current = true
      setShownVerification(verification)
    }).catch(() => {})
    return () => animation.cancel()
  }, [shownVerification, verification])

  useLayoutEffect(() => {
    if (!stepEnteringRef.current) return undefined
    stepEnteringRef.current = false
    const element = stepRef.current?.firstElementChild
    if (!element) return undefined
    const height = element.scrollHeight
    const animation = element.animate([
      { height: '0px', opacity: 0, transform: 'translateY(80px)' },
      { height: `${height}px`, opacity: 1, transform: 'translateY(0)' },
    ], {
      duration: 400,
      easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
      fill: 'forwards',
    })
    animation.finished.then(() => {
      element.style.height = 'auto'
      element.style.opacity = '1'
      element.style.transform = 'translateY(0)'
      animation.cancel()
    }).catch(() => {})
    return () => animation.cancel()
  }, [shownVerification])

  const requestPhrase = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/roblox/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), captcha: captchaToken }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not start Roblox verification.')
      setUsername(result.robloxUsername)
      setVerification(result)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const verifyAccount = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/roblox/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: shownVerification.challenge }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not verify the Roblox account.')
      window.localStorage.setItem('rorisk_user', JSON.stringify(result.user))
      notify({ type: 'success', message: 'Signed in successfully!' })
      onAuthenticated?.(result.user)
    } catch (verifyError) {
      setError(verifyError.message)
      notify({ type: 'error', message: verifyError.message || 'Verification failed.' })
    } finally {
      setLoading(false)
    }
  }

  if (shownVerification) {
    return (
      <div ref={stepRef} className="login-roblox" {...robloxScope}>
        <div className="verification-step" {...robloxScope}>
          <div className="verification-code-container" {...robloxScope}>
            <h3 {...robloxScope}>Please add the following phrase to your Roblox description page:</h3>
            <div className="code-box" {...robloxScope}>
              <code {...robloxScope}>{shownVerification.verificationCode}</code>
              <button className="copy-button" type="button" title="Copy verification code" onClick={() => copyText(shownVerification.verificationCode).then(() => notify({ type: 'success', message: 'Verification code copied to clipboard.' }), () => notify({ type: 'error', message: 'Failed to copy.' }))} {...robloxScope}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="none" {...robloxScope}>
                  <path d="M15.4567 1.6667H7.87683C6.29075 1.6667 5.00008 2.95737 5.00008 4.54345V5.00004H4.5435C2.95741 5.00004 1.66675 6.2907 1.66675 7.87679V15.4565C1.66675 17.0427 2.95741 18.3334 4.5435 18.3334H12.1232C13.5803 18.3334 14.7751 17.2402 14.9619 15.8334H15.4566C17.0427 15.8334 18.3334 14.5427 18.3334 12.9566V4.54345C18.3334 2.95737 17.0427 1.6667 15.4567 1.6667ZM16.6667 12.9566C16.6667 13.6239 16.1239 14.1667 15.4567 14.1667H15.0001V7.87679C15.0001 6.2907 13.7094 5.00004 12.1233 5.00004H6.66675V4.54345C6.66675 3.8762 7.20958 3.33337 7.87683 3.33337H15.4566C16.1239 3.33337 16.6667 3.8762 16.6667 4.54345V12.9566Z" fill="currentColor" {...robloxScope} />
                </svg>
              </button>
            </div>
            <div className="expiry-notice" {...robloxScope}>
              <span {...robloxScope}>Code expires in: <strong {...robloxScope}>{formatTime(remaining)}</strong></span>
            </div>
            <div className="warning-box" {...robloxScope}>
              <span {...robloxScope}><strong {...robloxScope}>NEVER</strong> share this phrase with anybody. If somebody asks for it then they are trying to <strong {...robloxScope}>steal your account and items!</strong></span>
            </div>
          </div>
          <div className="verification-instructions" {...robloxScope}>
            <h3 {...robloxScope}>How to add this to your profile:</h3>
            <ol {...robloxScope}>
              <li {...robloxScope}>Go to <a href="https://www.roblox.com/users/profile" target="_blank" rel="noopener noreferrer" {...robloxScope}>your Roblox profile</a></li>
              <li {...robloxScope}>Click on the &quot;Edit&quot; button</li>
              <li {...robloxScope}>Paste the verification code into your description</li>
              <li {...robloxScope}>Click &quot;Save&quot;</li>
            </ol>
          </div>
          {error && <p className="auth-inline-error" role="alert">{error}</p>}
          <div className="verification-buttons" {...robloxScope}>
            <button className="button secondary-button" type="button" onClick={() => setVerification(null)} disabled={loading} {...robloxScope}>Back</button>
            <button className="button primary-button" type="button" onClick={verifyAccount} disabled={loading || remaining <= 0} {...robloxScope}><span {...robloxScope}>{loading ? 'Checking...' : 'Verify Account'}</span></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={stepRef} className="login-roblox" {...robloxScope}>
      <div className="form-view" {...robloxScope}>
        <p className="login-description" {...robloxScope}>Log in with your Roblox username, then verify your account by putting a verification phrase in your Roblox bio.</p>
        <div className="credentials-element" {...robloxScope}>
          <label className="element-title" htmlFor="robloxUsername" {...robloxScope}>Roblox Username</label>
          <div className="element-input" {...robloxScope}>
            <input id="robloxUsername" type="text" placeholder="Enter your Roblox username" value={username} onChange={(event) => setUsername(event.target.value)} {...robloxScope} />
          </div>
        </div>
        <div className="credentials-checkboxes" {...robloxScope}>
          <div className="credentials-info" {...robloxScope}>
            <input className="checkbox-custom" type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} {...robloxScope} />
            {' I agree to the '}
            <a className="button-terms" href="/terms-of-service" {...robloxScope}>Terms of Service</a>
          </div>
          <div className="credentials-info" {...robloxScope}>
            <input className="checkbox-custom" type="checkbox" checked={age} onChange={(event) => setAge(event.target.checked)} {...robloxScope} />
            {' I confirm that '}
            <span className="button-terms" {...robloxScope}>I am at least 18 years old</span>
          </div>
        </div>
        <div className="captcha-wrapper" {...robloxScope}>
          <HcaptchaBox onVerify={setCaptchaToken} siteKey={siteKey} />
        </div>
        {error && <p className="auth-inline-error" role="alert">{error}</p>}
        <button className={`button-action${canContinue ? '' : ' button-action-disabled'}`} type="button" disabled={!canContinue} onClick={requestPhrase} {...robloxScope}><span {...robloxScope}>{loading ? 'Checking...' : 'Continue'}</span></button>
        <button className="button-back-login" type="button" onClick={() => setTab('login')} {...robloxScope}> Back to Sign In </button>
      </div>
    </div>
  )
}

function CredentialsTransition({ tab, setTab, onAuthenticated }) {
  const [displayedTab, setDisplayedTab] = useState(tab)
  const containerRef = useRef(null)
  const enteringRef = useRef(false)
  const transitionRef = useRef(0)

  useEffect(() => {
    if (tab === displayedTab) return undefined

    const element = containerRef.current?.firstElementChild
    if (!element) return undefined

    const transition = transitionRef.current + 1
    transitionRef.current = transition
    const height = element.scrollHeight
    const animation = element.animate(
      [
        { height: `${height}px`, opacity: 1, transform: 'translateY(0)' },
        { height: '0px', opacity: 0, transform: 'translateY(10px)' },
      ],
      { duration: 400, easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)', fill: 'forwards' },
    )

    animation.finished.then(() => {
      if (transitionRef.current !== transition) return
      enteringRef.current = true
      setDisplayedTab(tab)
    }).catch(() => {})

    return () => animation.cancel()
  }, [displayedTab, tab])

  useLayoutEffect(() => {
    if (!enteringRef.current) return undefined
    enteringRef.current = false

    const element = containerRef.current?.firstElementChild
    if (!element) return undefined

    const height = element.scrollHeight
    const animation = element.animate(
      [
        { height: '0px', opacity: 0, transform: 'translateY(100px)' },
        { height: `${height}px`, opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 400, easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)', fill: 'forwards' },
    )

    animation.finished.then(() => {
      element.style.height = 'auto'
      element.style.opacity = '1'
      element.style.transform = 'translateY(0)'
      animation.cancel()
    }).catch(() => {})

    return () => animation.cancel()
  }, [displayedTab])

  return <div ref={containerRef} className="login-credentials" {...credentialsScope} {...loginScope}>{displayedTab === 'login' ? <LoginForm setTab={setTab} onAuthenticated={onAuthenticated} /> : displayedTab === 'register' ? <RegisterForm setTab={setTab} onAuthenticated={onAuthenticated} /> : <AlternateForm type={displayedTab} setTab={setTab} />}</div>
}

function LoginContentTransition({ tab, credentialsTab, setTab, onAuthenticated }) {
  const requestedView = tab === 'roblox' ? 'roblox' : 'credentials'
  const [displayedView, setDisplayedView] = useState(requestedView)
  const contentRef = useRef(null)
  const enteringRef = useRef(false)
  const transitionRef = useRef(0)
  const leaveTimerRef = useRef(null)
  const enterTimerRef = useRef(null)

  useEffect(() => () => {
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current)
    if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current)
  }, [])

  useEffect(() => {
    if (requestedView === displayedView) return undefined
    const element = contentRef.current
    if (!element) return undefined

    const transition = transitionRef.current + 1
    transitionRef.current = transition
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current)
    element.style.height = `${element.scrollHeight}px`
    element.style.opacity = '1'
    element.style.transform = 'translateY(0)'
    element.getBoundingClientRect()
    element.style.height = '0px'
    element.style.opacity = '0'
    element.style.transform = 'translateY(10px)'

    leaveTimerRef.current = window.setTimeout(() => {
      if (transitionRef.current !== transition) return
      enteringRef.current = true
      setDisplayedView(requestedView)
    }, 400)

    return () => {
      if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current)
    }
  }, [displayedView, requestedView])

  useLayoutEffect(() => {
    if (!enteringRef.current) return undefined
    enteringRef.current = false
    const element = contentRef.current
    if (!element) return undefined

    element.style.height = 'auto'
    const height = element.scrollHeight
    element.style.height = '0px'
    element.style.opacity = '0'
    element.style.transform = 'translateY(10px)'
    element.getBoundingClientRect()
    element.style.height = `${height}px`
    element.style.opacity = '1'
    element.style.transform = 'translateY(0)'

    enterTimerRef.current = window.setTimeout(() => {
      element.style.height = 'auto'
      element.style.opacity = '1'
      element.style.transform = 'translateY(0)'
    }, 400)

    return () => {
      if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current)
    }
  }, [displayedView])

  return <div ref={contentRef} className="content-auth auth-content-swap" {...loginScope}>{displayedView === 'roblox' ? <RobloxForm setTab={setTab} onAuthenticated={onAuthenticated} /> : <CredentialsTransition tab={credentialsTab} setTab={setTab} onAuthenticated={onAuthenticated} />}</div>
}

function SigninModal({ initialTab, onClose, onAuthenticated }) {
  const [tab, setTab] = useState(initialTab)
  const [credentialsTab, setCredentialsTab] = useState(initialTab === 'register' ? 'register' : 'login')
  const [loginVisible, setLoginVisible] = useState(true)
  const [forgotVisible, setForgotVisible] = useState(false)
  const [closeLogin, setCloseLogin] = useState(false)
  const forgotRequestedRef = useRef(false)
  const forgotTimerRef = useRef(null)

  useEffect(() => () => {
    if (forgotTimerRef.current !== null) window.clearTimeout(forgotTimerRef.current)
  }, [])

  const selectTab = (nextTab) => {
    if (nextTab !== 'forgot') {
      setTab(nextTab)
      if (nextTab === 'login' || nextTab === 'register') setCredentialsTab(nextTab)
      return
    }

    forgotRequestedRef.current = true
    setCloseLogin(true)
    forgotTimerRef.current = window.setTimeout(() => setForgotVisible(true), 200)
  }

  const handleLoginClosed = () => {
    setLoginVisible(false)
    if (!forgotRequestedRef.current) onClose()
  }

  if (initialTab === 'recovery') {
    return <ModalAnimation onClose={onClose} label="Reset Password"><UpdatePassword onComplete={onClose} /></ModalAnimation>
  }

  return (
    <>
      {loginVisible && (
        <ModalAnimation onClose={handleLoginClosed} label={tab === 'register' ? 'Register' : 'Sign in'} closeRequest={closeLogin}>
          <div className="modal-login-container" {...loginScope} {...modalScope}>
            <div className="login-banner" {...loginScope}><img src="/Auth/login.1f4318ce.png" alt="Login Banner" {...loginScope} /></div>
            <div className="modal-login" {...loginScope}>
              <div className="login-form-area" {...loginScope}>
                <div className="login-content" {...loginScope}><LoginContentTransition tab={tab} credentialsTab={credentialsTab} setTab={selectTab} onAuthenticated={onAuthenticated} /></div>
              </div>
            </div>
          </div>
        </ModalAnimation>
      )}
      {forgotVisible && <ModalAnimation onClose={onClose} label="Reset Password"><ForgotPassword /></ModalAnimation>}
    </>
  )
}

export default SigninModal

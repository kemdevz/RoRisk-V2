import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ModalAnimation from './ModalAnimation'

const loginScope = { 'data-v-6f5ded14': '' }
const credentialsScope = { 'data-v-2e006020': '' }
const forgotScope = { 'data-v-8f8dae4c': '' }
const robloxScope = { 'data-v-3b09fc0c': '' }

function GoogleIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" /><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" /><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" /><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" /></svg>
}

function RobloxIcon() {
  return <svg className="roblox-icon" xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none" {...credentialsScope}><path d="M11.6763 0L0 44.1659L43.5771 56L55.2533 11.8341L11.6763 0ZM32.0849 35.827L19.9079 32.5185L23.1723 20.1769L35.3542 23.4855L32.0849 35.827Z" fill="currentColor" /></svg>
}

function SocialButtons({ onRoblox }) {
  return <><div className="social-divider" {...credentialsScope}>or</div><div className="social-buttons" {...credentialsScope}><button className="button-social google" type="button" onClick={() => window.open('https://api.rorisk.com/auth/google', 'GoogleAuth', 'width=500,height=600')} {...credentialsScope}><GoogleIcon /> Continue with Google</button><button className="button-social roblox" type="button" onClick={onRoblox} {...credentialsScope}><RobloxIcon /> Continue with Roblox</button></div></>
}

function LoginForm({ setTab }) {
  return <div className="form-view auth-form-transition" {...credentialsScope}><div className="form-content" {...credentialsScope}><form className="credentials-form" onSubmit={(event) => event.preventDefault()} {...credentialsScope}><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="loginInfo" {...credentialsScope}>Email or Username</label><div className="element-input" {...credentialsScope}><input id="loginInfo" type="text" placeholder="Enter your email or username" autoComplete="username" required {...credentialsScope} /></div></div><div className="credentials-element" {...credentialsScope}><div className="element-label-group" {...credentialsScope}><label className="element-title" htmlFor="loginPassword" {...credentialsScope}>Password</label><button className="button-forgot" type="button" onClick={() => setTab('forgot')} {...credentialsScope}><span {...credentialsScope}>Forgot Password?</span></button></div><div className="element-input" {...credentialsScope}><input id="loginPassword" type="password" placeholder="Enter your password" autoComplete="current-password" required {...credentialsScope} /></div></div></form></div><div className="action-section" {...credentialsScope}><button className="button-action" type="button" {...credentialsScope}>Sign In</button><SocialButtons onRoblox={() => setTab('roblox')} /><div className="switch-view" {...credentialsScope}>Don't have an account? <span onClick={() => setTab('register')} role="button" tabIndex="0" {...credentialsScope}>Sign Up</span></div></div></div>
}

function RegisterForm({ setTab }) {
  const [agree, setAgree] = useState(false)
  const [age, setAge] = useState(false)
  return <div className="form-view auth-form-transition" {...credentialsScope}><div className="form-content" {...credentialsScope}><form className="credentials-form" onSubmit={(event) => event.preventDefault()} {...credentialsScope}><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="username" {...credentialsScope}>Username</label><div className="element-input" {...credentialsScope}><input id="username" type="text" placeholder="Enter a username" minLength="3" maxLength="20" pattern="[A-Za-z0-9_]{3,20}" autoComplete="username" required {...credentialsScope} /></div></div><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="email" {...credentialsScope}>Email</label><div className="element-input" {...credentialsScope}><input id="email" type="email" placeholder="Enter your email address" autoComplete="email" required {...credentialsScope} /></div></div><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="password" {...credentialsScope}>Password</label><div className="element-input" {...credentialsScope}><input id="password" type="password" placeholder="Create a secure password" minLength="8" autoComplete="new-password" required {...credentialsScope} /></div></div><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="passwordConfirm" {...credentialsScope}>Password Confirm</label><div className="element-input" {...credentialsScope}><input id="passwordConfirm" type="password" placeholder="Re-enter your password" minLength="8" autoComplete="new-password" required {...credentialsScope} /></div></div><div className="credentials-checkboxes" {...credentialsScope}><div className="credentials-info" {...credentialsScope}><input className="checkbox-custom" type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} {...credentialsScope} /> I agree to the <a className="button-terms" href="/terms-of-service" {...credentialsScope}>Terms of Service</a></div><div className="credentials-info" {...credentialsScope}><input className="checkbox-custom" type="checkbox" checked={age} onChange={(event) => setAge(event.target.checked)} {...credentialsScope} /> I confirm that <span className="button-terms" {...credentialsScope}>I am at least 18 years old</span></div></div></form></div><div className="action-section" {...credentialsScope}><button className={`button-action${agree && age ? '' : ' button-action-disabled'}`} type="button" disabled={!agree || !age} {...credentialsScope}>Sign Up</button><SocialButtons onRoblox={() => setTab('roblox')} /><div className="switch-view" {...credentialsScope}>Already have an account? <span onClick={() => setTab('login')} role="button" tabIndex="0" {...credentialsScope}>Sign In</span></div></div></div>
}

function AlternateForm({ type, setTab }) {
  const isRoblox = type === 'roblox'
  return <div className="form-view auth-form-transition" {...credentialsScope}><div className="form-content" {...credentialsScope}><p className="auth-description">{isRoblox ? 'Log in with your Roblox username, then verify your account by putting a verification phrase in your Roblox bio.' : 'Enter your email address and we’ll send you instructions to reset your password.'}</p><div className="credentials-element" {...credentialsScope}><label className="element-title" htmlFor="alternateAuth" {...credentialsScope}>{isRoblox ? 'Roblox Username' : 'Email'}</label><div className="element-input" {...credentialsScope}><input id="alternateAuth" type={isRoblox ? 'text' : 'email'} placeholder={isRoblox ? 'Enter your Roblox username' : 'Enter your email address'} {...credentialsScope} /></div></div></div><div className="action-section" {...credentialsScope}><button className="button-action" type="button" {...credentialsScope}>{isRoblox ? 'Continue' : 'Send Reset Link'}</button><div className="switch-view" {...credentialsScope}><span onClick={() => setTab('login')} role="button" tabIndex="0" {...credentialsScope}>Back to Sign In</span></div></div></div>
}

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

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
            <button className="button-reset" type="button" disabled={!isEmailValid} {...forgotScope}>
              <div className="button-inner" {...forgotScope}>
                <span {...forgotScope}>Send Link</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function HcaptchaBox({ onVerify }) {
  const containerRef = useRef(null)

  useEffect(() => {
    let active = true
    let widgetId = null

    const renderCaptcha = () => {
      if (!active || !containerRef.current || !window.hcaptcha || containerRef.current.childElementCount > 0) return
      widgetId = window.hcaptcha.render(containerRef.current, {
        sitekey: '548690be-c60e-4fbe-b40c-8a2ee156fe60',
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
  }, [onVerify])

  return <div ref={containerRef} {...robloxScope} />
}

function RobloxForm({ setTab }) {
  const [username, setUsername] = useState('')
  const [agree, setAgree] = useState(false)
  const [age, setAge] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const canContinue = username.trim() && agree && age && captchaToken

  return (
    <div className="login-roblox" {...robloxScope}>
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
          <HcaptchaBox onVerify={setCaptchaToken} />
        </div>
        <button className={`button-action${canContinue ? '' : ' button-action-disabled'}`} type="button" disabled={!canContinue} {...robloxScope}><span {...robloxScope}>Continue</span></button>
        <button className="button-back-login" type="button" onClick={() => setTab('login')} {...robloxScope}> Back to Sign In </button>
      </div>
    </div>
  )
}

function CredentialsTransition({ tab, setTab }) {
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

  return <div ref={containerRef} className="login-credentials" {...credentialsScope} {...loginScope}>{displayedTab === 'login' ? <LoginForm setTab={setTab} /> : displayedTab === 'register' ? <RegisterForm setTab={setTab} /> : <AlternateForm type={displayedTab} setTab={setTab} />}</div>
}

function LoginContentTransition({ tab, credentialsTab, setTab }) {
  const requestedView = tab === 'roblox' ? 'roblox' : 'credentials'
  const [displayedView, setDisplayedView] = useState(requestedView)
  const contentRef = useRef(null)
  const enteringRef = useRef(false)
  const transitionRef = useRef(0)

  useEffect(() => {
    if (requestedView === displayedView) return undefined
    const element = contentRef.current
    if (!element) return undefined

    const transition = transitionRef.current + 1
    transitionRef.current = transition
    const height = element.scrollHeight
    const animation = element.animate(
      [{ height: `${height}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
      { duration: 400, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
    )

    animation.finished.then(() => {
      if (transitionRef.current !== transition) return
      enteringRef.current = true
      setDisplayedView(requestedView)
    }).catch(() => {})

    return () => animation.cancel()
  }, [displayedView, requestedView])

  useLayoutEffect(() => {
    if (!enteringRef.current) return undefined
    enteringRef.current = false
    const element = contentRef.current
    if (!element) return undefined

    const height = element.scrollHeight
    const animation = element.animate(
      [{ height: '0px', opacity: 0 }, { height: `${height}px`, opacity: 1 }],
      { duration: 400, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
    )

    animation.finished.then(() => {
      element.style.height = 'auto'
      element.style.opacity = '1'
      animation.cancel()
    }).catch(() => {})

    return () => animation.cancel()
  }, [displayedView])

  return <div ref={contentRef} className="content-auth" {...loginScope}>{displayedView === 'roblox' ? <RobloxForm setTab={setTab} /> : <CredentialsTransition tab={credentialsTab} setTab={setTab} />}</div>
}

function SigninModal({ initialTab, onClose }) {
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

  return (
    <>
      {loginVisible && (
        <ModalAnimation onClose={handleLoginClosed} label={tab === 'register' ? 'Register' : 'Sign in'} closeRequest={closeLogin}>
          <div className="modal-login-container" {...loginScope}>
            <div className="login-banner" {...loginScope}><img src="/Auth/login.1f4318ce.png" alt="Login Banner" {...loginScope} /></div>
            <div className="modal-login" {...loginScope}>
              <div className="login-form-area" {...loginScope}>
                <div className="login-content" {...loginScope}><LoginContentTransition tab={tab} credentialsTab={credentialsTab} setTab={selectTab} /></div>
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

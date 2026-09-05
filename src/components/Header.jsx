import { useEffect, useState } from 'react'

function NavbarLogo() {
  const logoMediaQuery = '(min-width: 1800px)'
  const [showVideoLogo, setShowVideoLogo] = useState(() =>
    window.matchMedia(logoMediaQuery).matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(logoMediaQuery)
    const updateLogo = (event) => setShowVideoLogo(event.matches)

    mediaQuery.addEventListener('change', updateLogo)
    return () => mediaQuery.removeEventListener('change', updateLogo)
  }, [])

  if (showVideoLogo) {
    return (
      <div data-v-1cdc1483="" className="navbar-left-logo" bis_skin_checked="1">
        <video
          data-v-1cdc1483=""
          src="/Logos/rorisk.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-label="RoRisk"
        />
      </div>
    )
  }

  return (
    <div
      data-v-1cdc1483=""
      className="navbar-left-logo-mobile"
      bis_skin_checked="1"
    >
      <img data-v-1cdc1483="" src="/Logos/rorisk.png" alt="logo" />
    </div>
  )
}

function Header({ onSignIn, onRegister }) {
  return (
    <div className="app-header" bis_skin_checked="1">
      <nav data-v-1cdc1483="" id="navbar" className="navbar-guest">
        <div data-v-1cdc1483="" className="navbar-left" bis_skin_checked="1">
          <a
            data-v-1cdc1483=""
            href="/"
            aria-current="page"
            className="router-link-exact-active router-link-active"
          >
            <NavbarLogo />
          </a>
          <div
            data-v-1cdc1483=""
            className="navbar-left-actions"
            bis_skin_checked="1"
          >
            <a data-v-1cdc1483="" href="/rewards" className="navbar-claim-cases">
              <svg
                data-v-1cdc1483=""
                xmlns="http://www.w3.org/2000/svg"
                width="25"
                height="25"
                viewBox="0 0 25 25"
                fill="none"
                className="navbar-claim-cases-icon"
              >
                <path
                  d="M3.3 16.5875V22.6125C3.30329 22.9154 3.4259 23.2046 3.64121 23.4176C3.85653 23.6306 4.14715 23.75 4.45 23.75H11.475V16.5875H3.3ZM13.525 23.75H20.55C20.8529 23.75 21.1435 23.6306 21.3587 23.4176C21.5741 23.2046 21.6968 22.9154 21.7 22.6125V16.5875H13.525V23.75ZM22.625 6.3625H20.325C20.5606 5.88403 20.6845 5.35833 20.6875 4.825C20.6842 3.8757 20.3048 2.96641 19.6324 2.29632C18.9599 1.62625 18.0492 1.24999 17.1 1.25C16.1083 1.29703 15.1501 1.62364 14.3361 2.19209C13.5222 2.76054 12.8856 3.54764 12.5 4.4625C12.1144 3.54764 11.4778 2.76054 10.6638 2.19209C9.84986 1.62364 8.8917 1.29703 7.9 1.25C6.9507 1.24999 6.04009 1.62625 5.36766 2.29632C4.69524 2.96641 4.31581 3.8757 4.3125 4.825C4.31546 5.35833 4.43941 5.88403 4.675 6.3625H2.375C1.75 6.3625 1.25 7.1 1.25 8V12.9125C1.25 13.8125 1.75 14.55 2.375 14.55H11.475V6.3625H13.525V14.55H22.625C23.25 14.55 23.75 13.8125 23.75 12.9125V8C23.75 7.1 23.25 6.3625 22.625 6.3625ZM7.9 6.3625C7.68729 6.38174 7.4729 6.35645 7.2705 6.28824C7.0681 6.22003 6.88214 6.1104 6.72445 5.96634C6.56677 5.82227 6.44084 5.64694 6.35468 5.4515C6.26851 5.25607 6.22401 5.04484 6.22401 4.83125C6.22401 4.61766 6.26851 4.40642 6.35468 4.211C6.44084 4.01556 6.56677 3.84022 6.72445 3.69616C6.88214 3.5521 7.0681 3.44247 7.2705 3.37426C7.4729 3.30605 7.68729 3.28076 7.9 3.3C9.65 3.3 10.6375 5.1 11.125 6.3625H7.9ZM17.1 6.3625H13.875C14.3625 5.1125 15.35 3.3 17.1 3.3C17.3127 3.28076 17.5271 3.30605 17.7295 3.37426C17.9319 3.44247 18.1179 3.5521 18.2755 3.69616C18.4333 3.84022 18.5591 4.01556 18.6454 4.211C18.7315 4.40642 18.776 4.61766 18.776 4.83125C18.776 5.04484 18.7315 5.25607 18.6454 5.4515C18.5591 5.64694 18.4333 5.82227 18.2755 5.96634C18.1179 6.1104 17.9319 6.22003 17.7295 6.28824C17.5271 6.35645 17.3127 6.38174 17.1 6.3625Z"
                  fill="currentColor"
                />
              </svg>
              <span data-v-1cdc1483="">Claim Free 4 Cases</span>
            </a>
            <div
              data-v-1cdc1483=""
              aria-hidden="true"
              className="divider-vertical"
              bis_skin_checked="1"
            />
            <a
              data-v-1cdc1483=""
              href="/race"
              className="navbar-race-btn"
              title="Weekly Race"
              aria-label="Weekly Race"
            >
              <svg
                data-v-1cdc1483=""
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
              >
                <path
                  d="M3.95801 1.09961H18.0413V2.26011H16.4463V8.02741C16.4462 8.74908 16.3028 9.46355 16.0242 10.1293C15.7457 10.7951 15.3376 11.3988 14.8237 11.9055C14.3099 12.4122 13.7004 12.8118 13.0308 13.081C12.3612 13.3501 11.6448 13.4836 10.9232 13.4735C7.95981 13.4328 5.55521 10.9941 5.55301 8.03071V2.26011H3.95801V1.09961ZM13.6116 17.1981C14.2518 17.1981 14.771 17.7173 14.771 18.3575V19.7391H16.4474V20.8996H5.55301V19.7391H7.22941V18.3586C7.22941 17.7184 7.74861 17.1992 8.38881 17.1992H9.29851V14.4129C9.85349 14.5617 10.4256 14.6368 11.0002 14.6362C11.5747 14.6365 12.1468 14.5618 12.7019 14.414V17.1992L13.6116 17.1981Z"
                  fill="currentColor"
                />
                <path
                  d="M17.6078 3.42102V4.58042H19.7396V7.19072C19.7389 7.8817 19.4919 8.5498 19.0429 9.07501C18.5939 9.60022 17.9724 9.94813 17.2899 10.0562C17.1558 10.4706 16.9811 10.8707 16.7685 11.2508H16.84C17.9164 11.2494 18.9482 10.8211 19.7093 10.06C20.4704 9.29894 20.8986 8.26708 20.9001 7.19072V3.41992L17.6078 3.42102ZM2.2606 7.19072C2.26138 7.88218 2.50885 8.55068 2.95852 9.07596C3.40818 9.60124 4.03052 9.94884 4.7136 10.0562C4.84825 10.4707 5.02364 10.8709 5.2372 11.2508H5.1602C4.08384 11.2494 3.05198 10.8211 2.29088 10.06C1.52978 9.29894 1.10155 8.26708 1.1001 7.19072V3.41992H4.3924V4.58042H2.2606V7.19072Z"
                  fill="currentColor"
                />
              </svg>
            </a>
          </div>
        </div>
        <div data-v-1cdc1483="" className="navbar-mid" bis_skin_checked="1" />
        <div data-v-1cdc1483="" className="navbar-right" bis_skin_checked="1">
          <div
            data-v-48b2574b=""
            data-v-1cdc1483=""
            className="auth-button-wrap"
            bis_skin_checked="1"
          >
            <button
              type="button"
              data-v-48b2574b=""
              className="auth-button auth-button-secondary"
              onClick={onSignIn}
            >
              Sign In
            </button>
            <button
              type="button"
              data-v-48b2574b=""
              className="auth-button auth-button-primary"
              onClick={onRegister}
            >
              Register
            </button>
          </div>
        </div>
      </nav>
    </div>
  )
}

export default Header

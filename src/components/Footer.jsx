const footerGroups = [
  {
    title: 'Games',
    links: [
      ['Battles', '/battles'],
      ['Blackjack', '/blackjack'],
      ['Upgrader', '/upgrader'],
      ['X-Roulette', '/x-roulette'],
      ['Mines', '/mines'],
      ['Coinflip', '/coinflip'],
      ['Dice', '/dice'],
      ['Cases', '/cases'],
    ],
  },
  {
    title: 'Platform',
    links: [
      ['Sponsors', 'https://discord.gg/rorisk'],
      ['Rewards', '/rewards'],
      ['Affiliates', '/affiliates'],
      ['Faucet', '#'],
    ],
  },
  {
    title: 'Information',
    links: [
      ['Terms of Service', '/terms-of-service'],
      ['Privacy Policy', '/privacy-policy'],
      ['Provably Fair', '/provably-fair'],
      ['Support', '#'],
    ],
  },
  {
    title: 'Socials',
    links: [
      ['Discord', 'https://discord.gg/rorisk'],
      ['Twitter', 'https://x.com/roriskcom'],
      ['Kick', 'https://kick.com/roriskcom'],
    ],
  },
]

function ContactIcon() {
  return (
    <svg
      className="injected-svg"
      xmlns="http://www.w3.org/2000/svg"
      width="128"
      height="128"
      viewBox="0 0 24 24"
      fill="none"
      data-src="https://cdn.hugeicons.com/icons/login-circle-01-solid-standard.svg?v=1.0.1"
      role="img"
      color="#000000"
      aria-hidden="true"
    >
      <path d="M11.9762 1.25C17.9133 1.25 22.7262 6.06294 22.7262 12C22.7262 17.9371 17.9133 22.75 11.9762 22.75C6.37638 22.75 1.77855 18.4681 1.27405 13H12.3121L10.0192 15.293C9.62868 15.6835 9.62865 16.3165 10.0192 16.707C10.4097 17.0975 11.0427 17.0975 11.4332 16.707L15.4332 12.707C15.8237 12.3165 15.8237 11.6835 15.4332 11.293L11.4332 7.29297C11.0427 6.90244 10.4097 6.90244 10.0192 7.29297C9.65309 7.65909 9.63047 8.2381 9.95081 8.63086L10.0192 8.70703L12.3121 11H1.27405C1.77855 5.53186 6.37638 1.25 11.9762 1.25Z" fill="#" />
    </svg>
  )
}

function Footer() {
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText('support@rorisk.com')
    } catch {
      // The production control remains usable even when clipboard permission is denied.
    }
  }

  return (
    <footer id="footer">
      <div className="footer-content">
        <div className="footer-left">
          <a href="/">
            <img src="/Footer/logo.ee8858f3.png" alt="RoRisk" />
          </a>
          <div className="info-text">
            RoRisk.com is an independent virtual arcade, not affiliated with Roblox Corporation. We don’t own or claim Roblox’s trademarks or content - any mention of “Roblox” is purely descriptive. All games are fair and focused on fun and our platform is intended for users 18+.
          </div>
          <div className="rights-reserved">© {new Date().getFullYear()} RoRisk. All rights reserved.</div>
          <div className="support-box-email" onClick={copyEmail} role="button" tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') copyEmail() }}>
            <ContactIcon />
            <span>support@rorisk.com</span>
          </div>
        </div>
        <div className="footer-right">
          {footerGroups.map(({ title, links }) => (
            <ul key={title}>
              <h3>{title}</h3>
              {links.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel={href.startsWith('http') ? 'noreferrer' : undefined}
                    onClick={href === '#' ? (event) => event.preventDefault() : undefined}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </footer>
  )
}

export default Footer

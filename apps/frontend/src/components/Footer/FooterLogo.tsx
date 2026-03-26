import styles from "./Footer.module.css";

const FooterLogo = () => {
  return (
    <div className={styles.logo}>
      <a href="#" className={styles.brand} aria-label="ConciergeHub">
        <img
          src="/icon-concierge.png"
          alt=""
          aria-hidden="true"
          className={styles.brandIcon}
          loading="lazy"
          decoding="async"
        />
        <span className={styles.brandText}>ConciergeHub</span>
      </a>
    </div>
  );
};

export default FooterLogo;

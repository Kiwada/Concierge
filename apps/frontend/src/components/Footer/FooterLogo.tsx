import Logo from "../Logo/Index";
import styles from "./Footer.module.css";

const FooterLogo = () => {
  return (
    <div className={styles.logo}>
      <Logo
        src="/logo-concierge-hub.png"
        alt="Logo ConciergeHub"
        className={styles.logoImage}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
};

export default FooterLogo;

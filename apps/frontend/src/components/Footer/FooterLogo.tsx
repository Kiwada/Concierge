import Logo from "../Logo/Index";
import styles from "./Footer.module.css";

const FooterLogo = () => {
  return (
    <div className={styles.logo}>
      <Logo
        src="/Icon.png"
        alt="Icon Concierge Hub"
        className={styles.logoImage}
      />
    </div>
  );
};

export default FooterLogo;

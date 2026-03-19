import { RiInstagramLine, RiTiktokLine, RiWhatsappLine } from "react-icons/ri";
import Link from "../Link";
import styles from "./Footer.module.css";

const FooterSocial = () => (
  <div className={styles.redes}>
    <h4 className={styles.titulo}>Redes</h4>
    <div className={styles.icones}>
      <Link href="#" className={styles.socialLink} aria-label="WhatsApp">
        <RiWhatsappLine className={styles.icone} />
      </Link>
      <Link href="#" className={styles.socialLink} aria-label="Instagram">
        <RiInstagramLine className={styles.icone} />
      </Link>
      <Link href="#" className={styles.socialLink} aria-label="TikTok">
        <RiTiktokLine className={styles.icone} />
      </Link>
    </div>
  </div>
);

export default FooterSocial;

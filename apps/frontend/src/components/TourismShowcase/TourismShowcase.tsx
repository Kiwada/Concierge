import { useEffect, useRef, useState } from "react";
import styles from "./TourismShowcase.module.css";

const TourismShowcase = () => {
  const topRef = useRef<HTMLElement | null>(null);
  const bottomRef = useRef<HTMLElement | null>(null);
  const [topVisible, setTopVisible] = useState(false);
  const [bottomVisible, setBottomVisible] = useState(false);
  const [topInView, setTopInView] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 24) setHasScrolled(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (hasScrolled && topInView) {
      setTopVisible(true);
    }
  }, [hasScrolled, topInView]);

  useEffect(() => {
    const topEl = topRef.current;
    const bottomEl = bottomRef.current;
    if (!topEl && !bottomEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target === topEl) {
            setTopInView(true);
          }
          if (entry.isIntersecting && entry.target === bottomEl) {
            setBottomVisible(true);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );

    if (topEl) observer.observe(topEl);
    if (bottomEl) observer.observe(bottomEl);

    return () => observer.disconnect();
  }, []);

  return (
    <section className={styles.showcase} aria-label="Destaques de turismo">
      <div className={styles.wave} aria-hidden="true" />

      <article ref={topRef} className={`${styles.block} ${styles.blockTop}`}>
        <div
          className={`${styles.visualTop} ${styles.reveal} ${styles.delay1} ${
            topVisible ? styles.isVisible : ""
          }`}
        >
          <div className={styles.blobLarge}>
            <img
              src="/assets/turismo/peninsula-marau.jpg"
              alt="Paisagem da Peninsula de Marau"
              className={styles.blobImage}
            />
          </div>
        </div>

        <div className={styles.contentTop}>
          <span
            className={`${styles.eyebrow} ${styles.reveal} ${styles.delay2} ${
              topVisible ? styles.isVisible : ""
            }`}
          >
            LITORAL DO PIAUI
          </span>
          <h2
            className={`${styles.title} ${styles.reveal} ${styles.delay3} ${
              topVisible ? styles.isVisible : ""
            }`}
          >
            Belezas unicas
            <br />
            entre mar, rio e dunas
          </h2>
          <p
            className={`${styles.description} ${styles.reveal} ${styles.delay4} ${
              topVisible ? styles.isVisible : ""
            }`}
          >
            Descubra um dos litorais mais autênticos do Brasil, com paisagens
            naturais, comunidades tradicionais e roteiros para quem busca
            tranquilidade e aventura na mesma viagem.
          </p>
          <p
            className={`${styles.description} ${styles.reveal} ${styles.delay5} ${
              topVisible ? styles.isVisible : ""
            }`}
          >
            Da orla de Luis Correia aos passeios no Delta do Parnaíba, cada
            parada revela cultura, gastronomia e cenarios inesqueciveis.
          </p>
        </div>
      </article>

      <div className={styles.wave} aria-hidden="true" />

      <article
        ref={bottomRef}
        className={`${styles.block} ${styles.blockBottom}`}
      >
        <span className={styles.watermark}>NATUREZA</span>

        <div className={styles.contentBottom}>
          <span
            className={`${styles.eyebrow} ${styles.reveal} ${styles.delay2} ${
              bottomVisible ? styles.isVisible : ""
            }`}
          >
            DELTA DO PARNAIBA
          </span>
          <h3
            className={`${styles.titleBottom} ${styles.reveal} ${
              styles.delay3
            } ${bottomVisible ? styles.isVisible : ""}`}
          >
            Explore o unico
            <br />
            delta em mar aberto das Americas
          </h3>
          <p
            className={`${styles.description} ${styles.reveal} ${styles.delay4} ${
              bottomVisible ? styles.isVisible : ""
            }`}
          >
            Passeios de lancha, ilhas, manguezais e pores do sol formam uma
            experiencia completa para quem quer viver o melhor do litoral
            piauiense.
          </p>
          <button
            type="button"
            className={`${styles.ctaButton} ${styles.reveal} ${styles.delay5} ${
              bottomVisible ? styles.isVisible : ""
            }`}
          >
            SAIBA MAIS
          </button>
        </div>

        <div
          className={`${styles.visualBottom} ${styles.reveal} ${styles.delay1} ${
            bottomVisible ? styles.isVisible : ""
          }`}
        >
          <div className={styles.blobSmall}>
            <img
              src="/assets/turismo/melancieiras.jpg"
              alt="Paisagem em Melancieiras no Delta do Parnaiba"
              className={styles.blobImage}
            />
          </div>
          <img
            src="/assets/vermelhuda.png"
            alt=""
            aria-hidden="true"
            className={styles.bird}
          />
        </div>
      </article>

      <div className={styles.wave} aria-hidden="true" />
    </section>
  );
};

export default TourismShowcase;

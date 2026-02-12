import styles from "./TourismShowcase.module.css";

const TourismShowcase = () => {
  return (
    <section className={styles.showcase} aria-label="Destaques de turismo">
      <div className={styles.wave} aria-hidden="true" />

      <article className={`${styles.block} ${styles.blockTop}`}>
        <div className={styles.visualTop}>
          <div className={styles.blobLarge}>
            <img
              src="/assets/turismo/delta-ambiental.jpg"
              alt="Paisagem da area de protecao ambiental do Delta"
              className={styles.blobImage}
            />
          </div>
        </div>

        <div className={styles.contentTop}>
          <span className={styles.eyebrow}>UM PARAISO PARA SUA FAMILIA</span>
          <h2 className={styles.title}>
            Momentos inesqueciveis
            <br />
            em meio a natureza
          </h2>
          <p className={styles.description}>
            Viva experiencias unicas com conforto, aventura e tranquilidade.
            Planeje sua viagem com praticidade e aproveite cada detalhe do
            destino.
          </p>
          <p className={styles.description}>
            Estrutura completa, atendimento humanizado e roteiros para todas as
            idades.
          </p>
        </div>
      </article>

      <div className={styles.wave} aria-hidden="true" />

      <article className={`${styles.block} ${styles.blockBottom}`}>
        <span className={styles.watermark}>NATUREZA</span>
        <img
          src="/assets/turismo/folha.png"
          alt=""
          aria-hidden="true"
          className={styles.leaf}
        />

        <div className={styles.contentBottom}>
          <span className={styles.eyebrow}>BARREIRINHAS</span>
          <h3 className={styles.titleBottom}>
            Descubra paisagens
            <br />
            que parecem surreais
          </h3>
          <p className={styles.description}>
            Um roteiro pensado para quem quer relaxar, explorar e registrar
            memorias unicas em um dos cenarios mais impressionantes do Brasil.
          </p>
          <button type="button" className={styles.ctaButton}>
            SAIBA MAIS
          </button>
        </div>

        <div className={styles.visualBottom}>
          <div className={styles.blobSmall}>
            <img
              src="/assets/turismo/melancieiras.jpg"
              alt="Paisagem em Melancieiras no Delta do Parnaiba"
              className={styles.blobImage}
            />
          </div>
          <img
            src="/assets/turismo/arara.png"
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

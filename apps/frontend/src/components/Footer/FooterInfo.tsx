import styles from "./Footer.module.css"


const FooterInfo = () => {
  return (
    <div className={styles.funcionamento}>
       <h4 className={styles.titulo}>IA para Turismo no Piaui</h4>
       <span>Recomendacoes inteligentes para cada perfil de turista</span>
       <span>Roteiros personalizados entre litoral, delta e serra</span>
       <span>Dicas em tempo real de passeios, gastronomia e hospedagem</span>
    </div>
  )
}

export default FooterInfo

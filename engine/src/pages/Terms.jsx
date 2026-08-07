import { LegalPage, LegalSection } from "../components/LegalPage";

/**
 * Termos de uso.
 *
 * Dois pontos aqui não são formalidade e existem para proteger o Engine de
 * verdade: deixar claro que a plataforma é vitrine e não parte na contratação
 * do serviço, e descrever cobrança, cancelamento e arrependimento antes de
 * existir o primeiro assinante.
 */
export function Terms() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="6 de agosto de 2026">
      <p>
        Ao usar o Engine você concorda com estes termos. Se não concordar, não
        use a plataforma.
      </p>

      <LegalSection title="O que é o Engine">
        <p>
          O Engine é uma plataforma onde você organiza metas de compra de
          veículo, acompanha o quanto já guardou, participa de uma comunidade e
          encontra prestadores de serviços automotivos.
        </p>
      </LegalSection>

      <LegalSection title="Sua conta">
        <p>
          Você precisa ter pelo menos 13 anos e fornecer informações
          verdadeiras. Você é responsável pelo que acontece na sua conta e por
          manter a senha em segurança.
        </p>
      </LegalSection>

      <LegalSection title="O que você publica">
        <p>
          O conteúdo que você publica continua sendo seu. Ao publicar, você nos
          dá permissão para exibi-lo dentro do Engine — inclusive publicamente,
          quando for uma meta compartilhada, um perfil ou um anúncio de serviço.
        </p>
        <p>Não é permitido publicar:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>conteúdo ilegal, ofensivo, discriminatório ou que ameace alguém;</li>
          <li>conteúdo sexual, violento ou que exponha terceiros sem consentimento;</li>
          <li>conteúdo que não é seu, sem permissão de quem é;</li>
          <li>golpe, propaganda enganosa ou serviço que você não presta;</li>
          <li>dados pessoais de outras pessoas.</li>
        </ul>
        <p>
          Você pode denunciar publicações e bloquear pessoas dentro do app.
          Conteúdo que viole estas regras pode ser removido, e a conta
          responsável pode ser suspensa ou encerrada.
        </p>
      </LegalSection>

      <LegalSection title="Serviços anunciados: o Engine não é parte">
        <p>
          Os serviços anunciados são oferecidos por terceiros, não pelo Engine.{" "}
          <strong className="text-[var(--engine-text)]">
            A contratação, o pagamento, a execução e a garantia do serviço são
            entre você e o prestador.
          </strong>{" "}
          O Engine é a vitrine onde vocês se encontram e não se responsabiliza
          pela qualidade, prazo, preço ou resultado do serviço contratado.
        </p>
        <p>
          Anúncios passam por uma triagem antes de serem publicados, mas isso não
          é atestado de qualidade nem recomendação. Confira quem você contrata.
        </p>
      </LegalSection>

      <LegalSection title="Plano Premium">
        <p>
          O plano Premium é uma assinatura mensal que libera duas coisas: navegar
          sem anúncios e divulgar serviços na plataforma.
        </p>
        <p>
          A cobrança é mensal e se renova automaticamente até você cancelar. O
          cancelamento pode ser feito a qualquer momento nas configurações, e o
          acesso continua até o fim do período já pago — sem multa e sem
          fidelidade.
        </p>
        <p>
          <strong className="text-[var(--engine-text)]">Arrependimento.</strong>{" "}
          Se você contratou pela internet e se arrepender em até 7 dias, tem
          direito ao cancelamento com devolução do valor pago, conforme o artigo
          49 do Código de Defesa do Consumidor.
        </p>
        <p>
          O pagamento é processado por Mercado Pago ou Stripe, conforme a sua
          região. Preços podem mudar, e mudanças são avisadas com antecedência —
          nunca valem para um período já pago.
        </p>
      </LegalSection>

      <LegalSection title="Estimativas e valores">
        <p>
          O simulador de custo de posse e as previsões de quando você atinge a
          meta são <strong className="text-[var(--engine-text)]">estimativas
          baseadas em médias públicas e no que você informa</strong>. Servem para
          planejamento, não são consultoria financeira e não substituem cotação
          real de seguro, financiamento ou manutenção.
        </p>
      </LegalSection>

      <LegalSection title="Disponibilidade">
        <p>
          Fazemos o possível para manter o Engine no ar, mas ele é oferecido como
          está, sem garantia de funcionamento ininterrupto. Funcionalidades podem
          mudar ou ser descontinuadas.
        </p>
      </LegalSection>

      <LegalSection title="Encerramento">
        <p>
          Você pode apagar sua conta quando quiser, nas configurações. Podemos
          suspender ou encerrar contas que violem estes termos, e nesse caso
          avisamos o motivo sempre que for possível.
        </p>
      </LegalSection>

      <LegalSection title="Lei aplicável">
        <p>
          Estes termos seguem a lei brasileira. Eventuais disputas serão
          resolvidas no foro do domicílio do consumidor, como prevê o Código de
          Defesa do Consumidor.
        </p>
      </LegalSection>

      <LegalSection title="Contato">
        <p>
          Dúvidas sobre estes termos:{" "}
          <a className="text-[var(--engine-accent)]" href="mailto:muxdtuber@gmail.com">
            muxdtuber@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}

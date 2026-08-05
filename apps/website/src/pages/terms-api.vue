<template>
  <div class="max-w-4xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
    <h1 class="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">Conditions Générales de Vente (API)</h1>
    <p class="text-sm text-gray-500 mb-8"><strong>Dernière mise à jour :</strong> {{ new Date().toLocaleDateString() }}</p>

    <p class="mb-6">
      Les présentes Conditions Générales de Vente (ci-après "CGV") s'appliquent à toute souscription et utilisation de l'API DubbingBase par un client professionnel (ci-après "le Client").
    </p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">1. Objet du Service</h2>
    <p class="mb-4">
      DubbingBase met à disposition une API REST permettant un accès programmatique à sa base de données (données sur les comédiens de doublage, les oeuvres et les castings vocaux). 
    </p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">2. Modalités de paiement et facturation</h2>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li>L'accès à l'API est facturé sous forme d'abonnement mensuel ou annuel, ou selon le volume de requêtes (pay-as-you-go) tel que défini lors de la souscription.</li>
      <li>Les factures sont payables à réception. Tout retard de paiement de plus de 30 jours entraînera des pénalités de retard au taux légal en vigueur, ainsi qu'une indemnité forfaitaire pour frais de recouvrement.</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">3. Service Level Agreement (SLA)</h2>
    <p class="mb-4">
      DubbingBase s'efforce de maintenir une disponibilité de l'API de 99% sur une base mensuelle. Toutefois, aucune garantie absolue n'est fournie concernant les temps d'arrêt imprévus.
    </p>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li>Les opérations de maintenance planifiées seront communiquées à l'avance et ne sont pas considérées comme des temps d'arrêt (downtime).</li>
      <li>En cas d'interruption supérieure à 4 heures consécutives imputable à notre infrastructure, le Client pourra demander un avoir proportionnel sur sa prochaine facture. Aucun remboursement monétaire direct ne sera effectué.</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">4. Utilisation et Révocation de Clé API</h2>
    <p class="mb-4">
      Le Client s'engage à faire un usage raisonnable de l'API. DubbingBase se réserve le droit de <strong>suspendre ou de révoquer sans préavis</strong> l'accès (révocation de la clé API) dans les cas suivants :
    </p>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li>Non-respect des limites de taux (rate limits) pouvant compromettre la stabilité de nos serveurs.</li>
      <li>Utilisation de l'API à des fins de constitution d'une base de données concurrente (scraping de masse).</li>
      <li>Défaut de paiement prolongé.</li>
      <li>Manquement grave aux présentes CGV ou aux CGU générales de DubbingBase.</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">5. Attribution et Crédit</h2>
    <p class="mb-4">
      Sauf accord spécifique dérogeant à cette règle, toute application ou service utilisant les données de l'API DubbingBase doit afficher de manière claire et visible la mention <strong>"Données fournies par DubbingBase"</strong> avec un lien vers dubbingbase.com.
    </p>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'CGV API - DubbingBase',
  meta: [
    {
      name: 'description',
      content: 'Conditions Générales de Vente pour l\'API DubbingBase.',
    }
  ]
})
</script>

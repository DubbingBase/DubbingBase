<template>
  <div class="max-w-4xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
    <h1 class="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">{{ $t('legal.termsApi.title') }}</h1>
    <p class="text-sm text-gray-500 mb-8"><strong>{{ $t('legal.termsApi.lastUpdated') }}</strong> {{ new Date().toLocaleDateString() }}</p>

    <p class="mb-6">{{ $t('legal.termsApi.intro') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.termsApi.section1') }}</h2>
    <p class="mb-4">{{ $t('legal.termsApi.section1Body') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.termsApi.section2') }}</h2>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li>{{ $t('legal.termsApi.billingBody') }}</li>
      <li>{{ $t('legal.termsApi.paymentTerms') }}</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.termsApi.section3') }}</h2>
    <p class="mb-4">{{ $t('legal.termsApi.slaAvailability') }}</p>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li>{{ $t('legal.termsApi.maintenance') }}</li>
      <li>{{ $t('legal.termsApi.slaCompensation') }}</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.termsApi.section4') }}</h2>
    <p class="mb-4">{{ $t('legal.termsApi.apiKeyIntro') }}<strong>{{ $t('legal.termsApi.suspendRevoke') }}</strong>{{ $t('legal.termsApi.revocationCases') }}</p>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li>{{ $t('legal.termsApi.rateLimitsViolation') }}</li>
      <li>{{ $t('legal.termsApi.competingDatabase') }}</li>
      <li>{{ $t('legal.termsApi.prolongedNonPayment') }}</li>
      <li>{{ $t('legal.termsApi.seriousBreach') }}</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.termsApi.section5') }}</h2>
    <p class="mb-4">{{ $t('legal.termsApi.attributionIntro') }}<strong>{{ $t('legal.termsApi.dataProvided') }}</strong>{{ $t('legal.termsApi.linkToSite') }}</p>
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

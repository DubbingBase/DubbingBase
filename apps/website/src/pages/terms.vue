<template>
  <div class="max-w-4xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
    <h1 class="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">{{ $t('legal.terms.title') }}</h1>
    <p class="text-sm text-gray-500 mb-8">
      <strong>{{ $t('legal.lastUpdated') }}</strong> {{ new Date().toLocaleDateString() }}
    </p>

    <p class="mb-6">{{ $t('legal.terms.welcome') }}</p>

    <p class="mb-10">{{ $t('legal.terms.acceptance') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.terms.section1') }}</h2>
    <p class="mb-6">{{ $t('legal.terms.serviceDescription') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.terms.section2') }}</h2>
    <p class="mb-4">{{ $t('legal.terms.ugcIntro') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section2_1') }}</h3>
    <p class="mb-4">{{ $t('legal.terms.licenseGrant') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section2_2') }}</h3>
    <p class="mb-4">{{ $t('legal.terms.scopeOfExploitation') }}<strong
        >{{ $t('legal.terms.commercializeRight') }}</strong
      >{{ $t('legal.terms.toThirdParties') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section2_3') }}</h3>
    <p class="mb-6">{{ $t('legal.terms.warranty') }}<br /><br />
      <strong
        >{{ $t('legal.terms.imageRights') }}</strong
      >{{ $t('legal.terms.imageRightsBody') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.terms.section3') }}</h2>
    <p class="mb-4">{{ $t('legal.terms.professionalAccounts') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section3_1') }}</h3>
    <p class="mb-4">{{ $t('legal.terms.claimingConsent') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section3_2') }}</h3>
    <p class="mb-6">{{ $t('legal.terms.withdrawalRights') }}<br /><br />
      <strong>{{ $t('legal.terms.however') }}</strong>{{ $t('legal.terms.withdrawalFactualTail') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.terms.section4') }}</h2>
    <p class="mb-4">{{ $t('legal.terms.postModerationIntro') }}<strong>{{ $t('legal.terms.postModeration') }}</strong>{{ $t('legal.terms.principleTail') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section4_1') }}</h3>
    <p class="mb-4">{{ $t('legal.terms.hostingProvider') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section4_2') }}</h3>
    <p class="mb-4">{{ $t('legal.terms.accuracyIntro') }}<strong
        >{{ $t('legal.terms.noGuarantee') }}</strong
      >{{ $t('legal.terms.accuracyTail') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section4_3') }}</h3>
    <p class="mb-6">{{ $t('legal.terms.reportingBody') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.terms.section5') }}</h2>
    <p class="mb-4">{{ $t('legal.terms.databaseRightsIntro') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section5_1') }}</h3>
    <p class="mb-4">{{ $t('legal.terms.scrapingIntro') }}<strong>{{ $t('legal.terms.strictlyProhibited') }}</strong>{{ $t('legal.terms.scrapingTail') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section5_2') }}</h3>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li>{{ $t('legal.terms.respectFor') }}<strong>{{ $t('legal.terms.rateLimits') }}</strong>{{ $t('legal.terms.rateLimitTail') }}</li>
      <li>{{ $t('legal.terms.apiCreditAn') }}<strong>{{ $t('legal.terms.creditObligation') }}</strong>{{ $t('legal.terms.creditTail') }}</li>
      <li>{{ $t('legal.terms.paidPlan') }}</li>
    </ul>
    <p class="mb-6 italic text-sm">{{ $t('legal.terms.apiDocNote') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.terms.section6') }}</h2>
    <p class="mb-4">{{ $t('legal.terms.platformIntro') }}<strong>{{ $t('legal.terms.structureOrganization') }}</strong>{{ $t('legal.terms.propertyTail') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section6_1') }}</h3>
    <p class="mb-4">{{ $t('legal.terms.suiGenerisIntro') }}<em>{{ $t('legal.terms.suiGeneris') }}</em>{{ $t('legal.terms.suiGenerisTail') }}</p>

    <h3 class="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-white">{{ $t('legal.terms.section6_2') }}</h3>
    <p class="mb-6">{{ $t('legal.terms.publicDomainVsStructure') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.terms.section7') }}</h2>
    <p class="mb-6">{{ $t('legal.terms.modifications') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.terms.section8') }}</h2>
    <p class="mb-12">{{ $t('legal.terms.lawJurisdiction') }}</p>
  </div>
</template>

<script setup lang="ts">
// Page meta can be added here if needed (e.g., SEO tags)
useHead({
  title: "Terms of Service",
  meta: [
    {
      name: "description",
      content: "Terms of Service for DubbingBase.",
    },
  ],
});
</script>

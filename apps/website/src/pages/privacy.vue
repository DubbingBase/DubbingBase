<template>
  <div class="max-w-4xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
    <h1 class="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">{{ $t('footer.privacy') }}</h1>
    <p class="text-sm text-gray-500 mb-8"><strong>{{ $t('legal.lastUpdated') }}</strong> {{ new Date().toLocaleDateString() }}</p>

    <p class="mb-6">{{ $t('legal.privacy.intro') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.privacy.dataController') }}</h2>
    <p class="mb-6">{{ $t('legal.privacy.dataControllerBody') }}<a href="mailto:contact@dubbingbase.com" class="text-cyan-600 dark:text-cyan-400 hover:underline">{{ $t('legal.contactEmail') }}</a>.
    </p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.privacy.technicalData') }}</h2>
    <p class="mb-4">{{ $t('legal.privacy.weUse') }}<strong>{{ $t('legal.privacy.supabaseName') }}</strong>{{ $t('legal.privacy.supabaseBackend') }}</p>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>{{ $t('legal.privacy.dataCollected') }}</strong>{{ $t('legal.privacy.dataCollectedBody') }}</li>
      <li><strong>{{ $t('legal.privacy.hostingLocation') }}</strong>{{ $t('legal.privacy.hostedWithin') }}<strong>{{ $t('legal.privacy.europeanUnion') }}</strong>{{ $t('legal.privacy.euStandardsTail') }}</li>
      <li><strong>{{ $t('legal.privacy.dataRetention') }}</strong> 
        <ul class="list-[circle] pl-6 mt-2 space-y-1">
          <li><strong>{{ $t('legal.privacy.inactiveAccounts') }}</strong>{{ $t('legal.privacy.inactiveAccountsBody') }}</li>
          <li><strong>{{ $t('legal.privacy.technicalLogs') }}</strong>{{ $t('legal.privacy.technicalLogsBody') }}</li>
          <li><strong>{{ $t('legal.privacy.backups') }}</strong>{{ $t('legal.privacy.backupsBody') }}</li>
        </ul>
      </li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.privacy.publicFigures') }}</h2>
    <p class="mb-4">{{ $t('legal.privacy.publicFiguresBody') }}</p>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>{{ $t('legal.privacy.legitimateInterest') }}</strong>{{ $t('legal.privacy.legitimateInterestBody') }}</li>
      <li><strong>{{ $t('legal.privacy.claimedProfiles') }}</strong>{{ $t('legal.privacy.claimedProfilesIntro') }}<strong>{{ $t('legal.privacy.explicitConsent') }}</strong>{{ $t('legal.privacy.consentWithdrawalTail') }}</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.privacy.yourRights') }}</h2>
    <p class="mb-4">{{ $t('legal.privacy.rightsIntro') }}</p>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>{{ $t('legal.privacy.rightOfAccess') }}</strong>{{ $t('legal.privacy.rightOfAccessBody') }}</li>
      <li><strong>{{ $t('legal.privacy.rightToRectification') }}</strong>{{ $t('legal.privacy.rightToRectificationBody') }}</li>
      <li><strong>{{ $t('legal.privacy.rightToErasure') }}</strong>{{ $t('legal.privacy.rightToErasureBody') }}</li>
      <li><strong>{{ $t('legal.privacy.rightToPortability') }}</strong>{{ $t('legal.privacy.rightToPortabilityBody') }}</li>
    </ul>
    <p class="mb-12">{{ $t('legal.privacy.exerciseRights') }}<a href="mailto:contact@dubbingbase.com" class="text-cyan-600 dark:text-cyan-400 font-medium hover:underline">{{ $t('legal.contactEmail') }}</a>{{ $t('legal.privacy.responseOneMonth') }}</p>
    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.privacy.cookies') }}</h2>
    <p class="mb-4">{{ $t('legal.privacy.weUse') }}<strong>{{ $t('legal.privacy.posthogName') }}</strong>{{ $t('legal.privacy.posthogPurpose') }}</p>
    <ul class="list-disc pl-6 mb-12 space-y-2">
      <li><strong>{{ $t('legal.privacy.anonymizedData') }}</strong>{{ $t('legal.privacy.anonymizedDataBody') }}</li>
      <li><strong>{{ $t('legal.privacy.cnilExemption') }}</strong>{{ $t('legal.privacy.cnilExemptionBody') }}</li>
      <li><strong>{{ $t('legal.privacy.essentialCookies') }}</strong>{{ $t('legal.privacy.essentialCookiesBody') }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Privacy Policy',
  meta: [
    {
      name: 'description',
      content: 'Privacy Policy and GDPR compliance information for DubbingBase.',
    }
  ]
})
</script>

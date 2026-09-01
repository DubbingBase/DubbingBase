<template>
  <div class="max-w-4xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
    <h1 class="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">{{ $t('legal.guidelines.title') }}</h1>
    <p class="text-sm text-gray-500 mb-8"><strong>{{ $t('legal.lastUpdated') }}</strong> {{ new Date().toLocaleDateString() }}</p>

    <p class="mb-6">{{ $t('legal.guidelines.welcome') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.guidelines.section1') }}</h2>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>{{ $t('legal.guidelines.verify') }}</strong>{{ $t('legal.guidelines.verifyBody') }}</li>
      <li><strong>{{ $t('legal.guidelines.citeOfficialSources') }}</strong>{{ $t('legal.guidelines.citeSourcesBody') }}</li>
      <li><strong>{{ $t('legal.guidelines.noSpeculation') }}</strong>{{ $t('legal.guidelines.noSpeculationBody') }}</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.guidelines.section2') }}</h2>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>{{ $t('legal.guidelines.assumeGoodFaith') }}</strong>{{ $t('legal.guidelines.assumeGoodFaithBody') }}</li>
      <li><strong>{{ $t('legal.guidelines.constructiveDiscussions') }}</strong>{{ $t('legal.guidelines.constructiveDiscussionsBody') }}</li>
      <li><strong>{{ $t('legal.guidelines.zeroTolerance') }}</strong>{{ $t('legal.guidelines.harassmentBody') }}</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.guidelines.section3') }}</h2>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>{{ $t('legal.guidelines.factualTone') }}</strong>{{ $t('legal.guidelines.factualToneBody') }}</li>
      <li><strong>{{ $t('legal.guidelines.useRating') }}</strong>{{ $t('legal.guidelines.useRatingBody') }}</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.guidelines.section4') }}</h2>
    <ul class="list-disc pl-6 mb-12 space-y-2">
      <li><strong>{{ $t('legal.guidelines.noVandalism') }}</strong>{{ $t('legal.guidelines.noVandalismBody') }}</li>
      <li><strong>{{ $t('legal.guidelines.sanctions') }}</strong>{{ $t('legal.guidelines.vandalismSanctions') }}</li>
    </ul>

    <p class="mb-8 text-center text-gray-500 italic">{{ $t('legal.guidelines.thanks') }}</p>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Community Guidelines',
  meta: [
    {
      name: 'description',
      content: 'Community Guidelines and contribution rules for DubbingBase.',
    }
  ]
})
</script>

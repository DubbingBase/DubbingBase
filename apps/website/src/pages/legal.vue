<template>
  <div class="max-w-4xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
    <h1 class="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">{{ $t('legal.legal.title') }}</h1>
    <p class="text-sm text-gray-500 mb-8"><strong>{{ $t('legal.lastUpdated') }}</strong> {{ new Date().toLocaleDateString() }}</p>

    <p class="mb-8">{{ $t('legal.legal.intro') }}</p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.legal.section1') }}</h2>
    <ul class="list-none space-y-2 mb-6">
      <li><strong>{{ $t('legal.legal.entityName') }}</strong>{{ $t('legal.legal.publisherName') }}</li>
      <li><strong>{{ $t('legal.legal.legalFormLabel') }}</strong>{{ $t('legal.legal.legalForm') }}</li>
      <li><strong>{{ $t('legal.legal.siretLabel') }}</strong>{{ $t('legal.legal.siret') }}</li>
      <li><strong>{{ $t('legal.legal.registeredAddress') }}</strong>{{ $t('legal.legal.registeredAddressBody') }}</li>
      <li><strong>{{ $t('legal.legal.email') }}</strong> <a href="mailto:contact@dubbingbase.com" class="text-cyan-600 dark:text-cyan-400 hover:underline">{{ $t('legal.contactEmail') }}</a></li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.legal.section2') }}</h2>
    <ul class="list-none space-y-2 mb-6">
      <li><strong>{{ $t('legal.legal.name') }}</strong>{{ $t('legal.legal.publisherName') }}</li>
      <li><strong>{{ $t('legal.legal.contact') }}</strong> <a href="mailto:contact@dubbingbase.com" class="text-cyan-600 dark:text-cyan-400 hover:underline">{{ $t('legal.contactEmail') }}</a></li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">{{ $t('legal.legal.section3') }}</h2>
    <p class="mb-4">{{ $t('legal.legal.hostingProvidersIntro') }}</p>
    
    <h3 class="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-white">{{ $t('legal.legal.frontendCdn') }}</h3>
    <ul class="list-none space-y-2 mb-6">
      <li><strong>{{ $t('legal.legal.hostName') }}</strong>{{ $t('legal.legal.cloudflareName') }}</li>
      <li><strong>{{ $t('legal.legal.address') }}</strong>{{ $t('legal.legal.cloudflareAddress') }}</li>
      <li><strong>{{ $t('legal.legal.website') }}</strong> <a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer" class="text-cyan-600 dark:text-cyan-400 hover:underline">{{ $t('legal.legal.cloudflareWebsite') }}</a></li>
    </ul>

    <h3 class="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-white">{{ $t('legal.legal.backendDatabase') }}</h3>
    <ul class="list-none space-y-2 mb-12">
      <li><strong>{{ $t('legal.legal.hostName') }}</strong>{{ $t('legal.legal.supabaseName') }}</li>
      <li><strong>{{ $t('legal.legal.address') }}</strong>{{ $t('legal.legal.supabaseAddress') }}</li>
      <li><strong>{{ $t('legal.legal.website') }}</strong> <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" class="text-cyan-600 dark:text-cyan-400 hover:underline">{{ $t('legal.legal.supabaseWebsite') }}</a></li>
    </ul>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Legal Notice',
  meta: [
    {
      name: 'description',
      content: 'Legal Notice and publisher information for DubbingBase.',
    }
  ]
})
</script>

<template>
  <div class="max-w-4xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
    <h1 class="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">Legal Notice (Mentions Légales)</h1>
    <p class="text-sm text-gray-500 mb-8"><strong>Last Updated:</strong> {{ new Date().toLocaleDateString() }}</p>

    <p class="mb-8">
      In accordance with the provisions of Articles 6-III and 19 of the French Law for Confidence in the Digital Economy (L.C.E.N.), we bring the following information to the attention of users and visitors of the DubbingBase website:
    </p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">1. Publisher Information (Éditeur)</h2>
    <ul class="list-none space-y-2 mb-6">
      <li><strong>Entity Name:</strong> Quentin Goinaud</li>
      <li><strong>Legal Form:</strong> Auto-entrepreneur</li>
      <li><strong>SIRET:</strong> 851 366 922 00033</li>
      <li><strong>Registered Address:</strong> For privacy reasons, the personal address of the publisher is withheld. Legal authorities may request it directly from the hosting providers below in accordance with LCEN regulations.</li>
      <li><strong>Email:</strong> <a href="mailto:contact@dubbingbase.com" class="text-cyan-600 dark:text-cyan-400 hover:underline">contact@dubbingbase.com</a></li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">2. Director of Publication (Directeur de la publication)</h2>
    <ul class="list-none space-y-2 mb-6">
      <li><strong>Name:</strong> Quentin Goinaud</li>
      <li><strong>Contact:</strong> <a href="mailto:contact@dubbingbase.com" class="text-cyan-600 dark:text-cyan-400 hover:underline">contact@dubbingbase.com</a></li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">3. Hosting Providers (Hébergeurs)</h2>
    <p class="mb-4">The website and its database are hosted by the following providers:</p>
    
    <h3 class="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-white">Frontend & CDN</h3>
    <ul class="list-none space-y-2 mb-6">
      <li><strong>Host Name:</strong> Cloudflare, Inc.</li>
      <li><strong>Address:</strong> 101 Townsend St, San Francisco, CA 94107, USA</li>
      <li><strong>Website:</strong> <a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer" class="text-cyan-600 dark:text-cyan-400 hover:underline">cloudflare.com</a></li>
    </ul>

    <h3 class="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-white">Backend & Database</h3>
    <ul class="list-none space-y-2 mb-12">
      <li><strong>Host Name:</strong> Supabase, Inc.</li>
      <li><strong>Address:</strong> 970 11th St, San Francisco, CA 94103, USA (Data hosted in the EU)</li>
      <li><strong>Website:</strong> <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" class="text-cyan-600 dark:text-cyan-400 hover:underline">supabase.com</a></li>
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

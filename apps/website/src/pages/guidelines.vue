<template>
  <div class="max-w-4xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
    <h1 class="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">Community Guidelines</h1>
    <p class="text-sm text-gray-500 mb-8"><strong>Last Updated:</strong> {{ new Date().toLocaleDateString() }}</p>

    <p class="mb-6">
      Welcome to DubbingBase! Our platform thrives on community contributions. To maintain a high-quality, reliable, and respectful environment for voice acting enthusiasts and professionals alike, we ask all contributors to adhere to the following guidelines.
    </p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">1. Accuracy and Sourcing</h2>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>Verify Before You Add:</strong> Ensure that the casting information (who voiced whom) is accurate before submitting it.</li>
      <li><strong>Cite Official Sources:</strong> Whenever possible, base your contributions on official end credits, verified studio announcements, or direct confirmations from the voice actors themselves.</li>
      <li><strong>No Speculation:</strong> Do not guess a voice actor based purely on "voice recognition" unless it's universally accepted or officially confirmed. If you are unsure, mark it for community discussion rather than submitting it as a definitive fact.</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">2. Respectful Collaboration</h2>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>Assume Good Faith:</strong> If someone corrects your contribution, assume they are trying to improve the database, not attack you personally.</li>
      <li><strong>Constructive Discussions:</strong> Use the discussion features to resolve conflicting casting info politely. Do not engage in edit wars.</li>
      <li><strong>Zero Tolerance for Harassment:</strong> Bullying, hate speech, or harassment towards other community members or voice actors will result in an immediate and permanent ban.</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">3. Neutral Point of View</h2>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>Factual Tone:</strong> When writing biographies or notes, stick to the facts. Avoid expressing personal opinions about the quality of a dub or an actor's performance in encyclopedic fields.</li>
      <li><strong>Use the Rating System:</strong> If you want to express your opinion on a performance, use the dedicated rating and review features instead of altering factual database entries.</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">4. Vandalism and Spam</h2>
    <ul class="list-disc pl-6 mb-12 space-y-2">
      <li><strong>No Vandalism:</strong> Deliberately inserting false information, deleting valid data, or corrupting the database is strictly prohibited.</li>
      <li><strong>Sanctions:</strong> Accounts caught engaging in vandalism or spamming will have their editing privileges revoked permanently without warning, and their changes will be reverted.</li>
    </ul>

    <p class="mb-8 text-center text-gray-500 italic">
      Thank you for helping us build the most comprehensive and accurate dubbing database in the world!
    </p>
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

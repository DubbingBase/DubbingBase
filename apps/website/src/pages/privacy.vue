<template>
  <div class="max-w-4xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
    <h1 class="text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">Privacy Policy</h1>
    <p class="text-sm text-gray-500 mb-8"><strong>Last Updated:</strong> {{ new Date().toLocaleDateString() }}</p>

    <p class="mb-6">
      At DubbingBase, we are committed to protecting your privacy and ensuring the security of your personal data. This Privacy Policy explains how we collect, use, and store your data in compliance with the General Data Protection Regulation (GDPR).
    </p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">1. Data Controller</h2>
    <p class="mb-6">
      The data controller responsible for your personal information is Quentin Goinaud, based in France. You can contact us regarding any privacy matters at <a href="mailto:contact@dubbingbase.com" class="text-cyan-600 dark:text-cyan-400 hover:underline">contact@dubbingbase.com</a>.
    </p>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">2. Technical Data & Authentication</h2>
    <p class="mb-4">
      We use <strong>Supabase</strong> as our backend provider for database and authentication services.
    </p>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>Data Collected:</strong> When you register, we collect your email address and a securely hashed version of your password. We also automatically collect technical logs (like IP addresses) necessary for security and debugging purposes.</li>
      <li><strong>Hosting Location:</strong> All our Supabase databases and authentication servers are hosted within the <strong>European Union</strong>, ensuring strict adherence to European data protection standards.</li>
      <li><strong>Data Retention:</strong> 
        <ul class="list-[circle] pl-6 mt-2 space-y-1">
          <li><strong>Inactive Accounts:</strong> User accounts inactive for more than 3 years will be deleted.</li>
          <li><strong>Technical Logs:</strong> Server and security logs are kept for a maximum of 30 days.</li>
          <li><strong>Backups:</strong> Database backups are stored for a rolling period of 7 to 30 days. If you request deletion, your data will naturally expire from our backups at the end of this cycle.</li>
        </ul>
      </li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">3. Public Figures and Voice Actor Data</h2>
    <p class="mb-4">
      DubbingBase acts as an encyclopedic resource. We display factual information regarding the professional careers (dubbing roles) of voice actors.
    </p>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>Legitimate Interest:</strong> The public display of professional, factual data related to public works is processed under the legal basis of legitimate interest and public right to information.</li>
      <li><strong>Claimed Profiles:</strong> When a voice actor "claims" their page to add a personal biography or contact information, this data is processed based on their <strong>explicit consent</strong>. Voice actors can withdraw this consent at any time to remove their personal biography, although factual career history will remain public.</li>
    </ul>

    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">4. Your Rights</h2>
    <p class="mb-4">
      Under the GDPR, you have the following rights regarding your personal data:
    </p>
    <ul class="list-disc pl-6 mb-6 space-y-2">
      <li><strong>Right of Access:</strong> You can request a copy of the personal data we hold about you.</li>
      <li><strong>Right to Rectification:</strong> You can ask us to correct inaccurate or incomplete data.</li>
      <li><strong>Right to Erasure (Right to be Forgotten):</strong> You can request the deletion of your personal account and associated personal data.</li>
      <li><strong>Right to Data Portability:</strong> You can request your data in a structured, commonly used format.</li>
    </ul>
    <p class="mb-12">
      To exercise any of these rights, please send an email to <a href="mailto:contact@dubbingbase.com" class="text-cyan-600 dark:text-cyan-400 font-medium hover:underline">contact@dubbingbase.com</a>. We will respond to your request within one month.
    </p>
    <h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">5. Cookies and Analytics</h2>
    <p class="mb-4">
      We use <strong>PostHog</strong> to understand how users interact with our platform and to manage feature rollouts (feature flags).
    </p>
    <ul class="list-disc pl-6 mb-12 space-y-2">
      <li><strong>Anonymized Data:</strong> We have configured PostHog to strictly anonymize your data. We do not track your IP address cross-site, nor do we associate your analytics session with your personal email address.</li>
      <li><strong>CNIL Exemption:</strong> Because this telemetry is strictly limited to audience measurement and is fully anonymized on our end, it falls under the cookie consent exemption according to the French CNIL guidelines. Therefore, we do not require a cookie consent banner for these analytics.</li>
      <li><strong>Essential Cookies:</strong> The only cookies stored on your device are strictly necessary technical cookies (such as those used by Supabase to maintain your active login session).</li>
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

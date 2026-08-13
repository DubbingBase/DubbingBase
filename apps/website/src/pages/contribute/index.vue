<template>
  <div class="min-h-screen bg-[#121212] text-[#e0e0e0] py-12 px-4 sm:px-6 lg:px-8 font-sans">
    <div class="max-w-5xl mx-auto space-y-12">
      <!-- Header Section -->
      <div class="text-center space-y-4">
        <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 animate-pulse-slow">
          Contribution Hub
        </h1>
        <p class="text-lg md:text-xl text-[#a0a0a0] max-w-2xl mx-auto">
          Help us build the most complete dubbing database in the world. Complete micro-tasks to earn points and climb the leaderboard!
        </p>
      </div>

      <!-- Stats / Rank Section -->
      <div class="bg-[#1d1d1d]/80 backdrop-blur-md rounded-2xl p-6 border border-[#2a2a2a] shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 transition-transform hover:scale-[1.01]">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
            LV
          </div>
          <div>
            <h2 class="text-2xl font-bold text-white">Bronze Contributor</h2>
            <p class="text-[#a0a0a0]">Current Score: <span class="text-emerald-400 font-mono font-semibold">1,250 pts</span></p>
          </div>
        </div>
        <div class="w-full md:w-1/2">
          <div class="flex justify-between text-sm mb-2 text-[#a0a0a0]">
            <span>Progress to Silver</span>
            <span>2,000 pts</span>
          </div>
          <div class="w-full bg-[#2a2a2a] rounded-full h-3 overflow-hidden">
            <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full" style="width: 62%"></div>
          </div>
        </div>
      </div>

      <!-- Start Contributing CTA -->
      <div class="flex flex-col items-center justify-center space-y-6 py-12 bg-[#1d1d1d] rounded-3xl border border-[#2a2a2a] shadow-2xl relative overflow-hidden">
        <div class="absolute inset-0 pointer-events-none bg-gradient-to-br from-blue-500/5 to-purple-500/5"></div>
        <h3 class="text-3xl font-bold text-white text-center relative z-10">Ready to help?</h3>
        <p class="text-[#a0a0a0] text-center max-w-lg relative z-10 text-lg">
          Jump into the unified task feed. We'll find profiles and studios that are missing data, and you can fill in whatever you know!
        </p>
        <NuxtLink :to="$localePath('/contribute/task/play')" class="group relative mt-4 px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl font-bold text-xl text-white shadow-[0_0_40px_rgba(59,130,246,0.4)] hover:shadow-[0_0_60px_rgba(168,85,247,0.6)] hover:-translate-y-1 transition-all overflow-hidden flex items-center gap-3">
          <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <span class="relative z-10">Start Contributing</span>
          <svg class="w-6 h-6 relative z-10 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </NuxtLink>
      </div>

      <!-- Live Activity Ticker -->
      <div class="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a] overflow-hidden relative h-16 flex items-center">
        <div class="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#1a1a1a] to-transparent z-10"></div>
        <div class="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#1a1a1a] to-transparent z-10"></div>
        <div class="flex animate-[ticker_20s_linear_infinite] whitespace-nowrap gap-8 text-sm text-[#a0a0a0]">
          <span v-for="activity in recentActivities" :key="activity.id" class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> 
            <b>{{ activity.user_name }}</b> {{ activity.action.replace(/_/g, ' ') }} for {{ activity.entity_name }} (+{{ activity.points_awarded }} pts)
          </span>
          <span v-if="recentActivities.length === 0" class="text-[#a0a0a0]">No recent activities found.</span>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">

const supabase = useSupabaseClient();

const { data: recentActivitiesData } = await useAsyncData('recent-contributions', async () => {
  const { data, error } = await supabase.rpc('get_recent_contributions', { limit_param: 10 });
  if (error) return [];
  return data || [];
});

const recentActivities = computed(() => recentActivitiesData.value || []);
</script>

<style scoped>
@keyframes ticker {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
.animate-pulse-slow {
  animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>

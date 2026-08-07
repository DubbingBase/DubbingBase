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

      <!-- Mission Grid -->
      <div class="space-y-6">
        <h3 class="text-2xl font-bold text-white border-b border-[#2a2a2a] pb-2">Available Missions</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <!-- Mission Card: Voice Actor Images -->
          <NuxtLink :to="$localePath('/contribute/task/missing_va_image')" class="group relative bg-[#1d1d1d] rounded-2xl p-6 border border-[#2a2a2a] hover:border-blue-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:-translate-y-1 overflow-hidden flex flex-col h-full">
            <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg class="w-24 h-24 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="z-10 flex-grow space-y-4">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium">
                <span class="w-2 h-2 rounded-full bg-blue-400"></span> Image Hunter
              </div>
              <h4 class="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">Find Missing Faces</h4>
              <p class="text-[#a0a0a0] text-sm">
                Many voice actors in our database are missing profile pictures. Help us put a face to the voice!
              </p>
            </div>
            <div class="z-10 mt-6 pt-4 border-t border-[#2a2a2a] flex justify-between items-center text-sm">
              <span class="text-emerald-400 font-mono font-medium">+10 pts / task</span>
              <span class="text-blue-400 font-medium group-hover:translate-x-1 transition-transform">Start &rarr;</span>
            </div>
          </NuxtLink>

          <!-- Mission Card: Studio Logos -->
          <NuxtLink :to="$localePath('/contribute/task/missing_studio_logo')" class="group relative bg-[#1d1d1d] rounded-2xl p-6 border border-[#2a2a2a] hover:border-purple-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:-translate-y-1 overflow-hidden flex flex-col h-full">
            <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg class="w-24 h-24 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div class="z-10 flex-grow space-y-4">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-sm font-medium">
                <span class="w-2 h-2 rounded-full bg-purple-400"></span> Studio Scout
              </div>
              <h4 class="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">Add Studio Logos</h4>
              <p class="text-[#a0a0a0] text-sm">
                Studios need representation too. Find and upload high-quality logos for dubbing studios.
              </p>
            </div>
            <div class="z-10 mt-6 pt-4 border-t border-[#2a2a2a] flex justify-between items-center text-sm">
              <span class="text-emerald-400 font-mono font-medium">+15 pts / task</span>
              <span class="text-purple-400 font-medium group-hover:translate-x-1 transition-transform">Start &rarr;</span>
            </div>
          </NuxtLink>

          <!-- Mission Card: Coming Soon -->
          <div class="group relative bg-[#1d1d1d]/50 rounded-2xl p-6 border border-[#2a2a2a] overflow-hidden flex flex-col h-full opacity-70">
            <div class="z-10 flex-grow space-y-4">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-500/10 text-gray-400 text-sm font-medium">
                <span class="w-2 h-2 rounded-full bg-gray-400"></span> Coming Soon
              </div>
              <h4 class="text-xl font-bold text-white">Casting Director</h4>
              <p class="text-[#a0a0a0] text-sm">
                Assign voice actors to missing roles in popular dubbing projects.
              </p>
            </div>
            <div class="z-10 mt-6 pt-4 border-t border-[#2a2a2a] flex justify-between items-center text-sm">
              <span class="text-gray-500 font-mono font-medium">??? pts / task</span>
              <span class="text-gray-500 font-medium">Locked</span>
            </div>
          </div>

        </div>
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
import { ref, onMounted } from 'vue';

const supabase = useSupabaseClient();
const recentActivities = ref<any[]>([]);

onMounted(async () => {
  const { data, error } = await supabase.rpc('get_recent_contributions', { limit_param: 10 });
  if (!error && data) {
    recentActivities.value = data;
  }
});
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

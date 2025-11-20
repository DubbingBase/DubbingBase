<template>
  <div>
    <ion-card>
      <ion-card-header>
        <ion-card-title>Duplicate Voice Actors</ion-card-title>
        <ion-card-subtitle>
          Find and merge duplicate voice actors in the database.
        </ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <ion-button @click="fetchDuplicates" :disabled="loading">
          {{ loading ? 'Searching...' : 'Find Duplicates' }}
        </ion-button>
        <div v-if="error" class="error">{{ error }}</div>
        <div v-if="duplicates.length">
          <div v-for="(group, idx) in duplicates" :key="idx" class="duplicate-group">
            <h3>Possible Duplicates</h3>
            <ion-list>
              <ion-item v-for="actor in group.actors" :key="actor.id">
                <ion-label>{{ actor.firstname }} {{ actor.lastname }} (ID: {{ actor.id }})</ion-label>
              </ion-item>
            </ion-list>
            <ion-select v-model="group.selectedId" placeholder="Select ID to keep">
              <ion-select-option v-for="actor in group.actors" :key="actor.id" :value="actor.id">
                {{ actor.firstname }} {{ actor.lastname }} (ID: {{ actor.id }})
              </ion-select-option>
            </ion-select>
            <ion-button color="success" @click="mergeGroup(group)" :disabled="!group.selectedId || merging">
              {{ merging ? 'Merging...' : 'Merge Selected' }}
            </ion-button>
          </div>
        </div>
        <div v-else-if="!loading">No duplicates found.</div>
      </ion-card-content>
    </ion-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonButton, IonList, IonItem, IonLabel, IonSelect, IonSelectOption } from '@ionic/vue';
import { supabase } from '@/api/supabase';

const loading = ref(false);
const merging = ref(false);
const error = ref('');
const duplicates = ref<any[]>([]);

async function fetchDuplicates() {
  loading.value = true;
  error.value = '';
  duplicates.value = [];
  // Call a backend function to find duplicate voice actors
  const { data, error: err } = await supabase.functions.invoke('find_duplicate_voice_actors');
  if (err) {
    error.value = err.message || 'Failed to fetch duplicates.';
  } else {
    // Expecting data as [{ actors: [{id, firstname, lastname}], selectedId: null }]
    duplicates.value = (data || []).map((group: any) => ({ ...group, selectedId: null }));
  }
  loading.value = false;
}

async function mergeGroup(group: any) {
  if (!group.selectedId) return;
  merging.value = true;
  error.value = '';
  // Call a backend function to merge duplicates
  const { error: err } = await supabase.functions.invoke('merge_voice_actor_duplicates', {
    body: {
      keepId: group.selectedId,
      ids: group.actors.map((a: any) => a.id).filter((id: any) => id !== group.selectedId),
    },
  });
  if (err) {
    error.value = err.message ?? err.error ?? 'Failed to merge.';
  } else {
    // Remove group from list
    duplicates.value = duplicates.value.filter((g: any) => g !== group);
  }
  merging.value = false;
}
</script>

<style scoped>
.duplicate-group {
  margin-bottom: 2rem;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 8px;
}
.error {
  color: #e74c3c;
  margin: 1rem 0;
}
</style>

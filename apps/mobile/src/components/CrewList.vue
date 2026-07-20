<template>
  <div class="crew-list">
    <div class="inner-list">
      <template v-if="!groupedCrew || Object.keys(groupedCrew).length === 0">
        <NoActors />
      </template>
      <template v-else>
        <!-- Loop over jobs -->
        <div
          v-for="(members, jobName) in groupedCrew"
          :key="String(jobName)"
          class="actor-with-voice-actors"
        >
          <!-- Job Title Header -->
          <div class="character-name">
            <div class="name">{{ jobName }}</div>
          </div>

          <!-- Personnel List -->
          <div class="voice-actors-section">
            <div class="voice-actors-scroll">
              <div class="voice-actors-container">
                <template v-for="member in members" :key="member.id">
                  <router-link
                    v-if="member.person?.id"
                    class="voice-actor-item no-link"
                    :to="{
                      name: 'VoiceActorDetails',
                      params: { id: member.person.id },
                    }"
                  >
                    <PersonItem
                      class="voice-actor-item"
                      :person="toPersonData(member.person, String(jobName))"
                      type="voice-actor"
                    />
                  </router-link>
                </template>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import NoActors from "./NoActors.vue";
import PersonItem, { PersonData } from "./PersonItem.vue";

const props = defineProps<{
  groupedCrew: Record<string, any[]>;
}>();

const toPersonData = (person: any, jobName: string): PersonData => {
  return {
    id: person.id,
    tmdb_id: 0,
    name: `${person.firstname} ${person.lastname}`,
    profile_picture: person.profile_picture,
    performance: jobName,
    data: person,
  };
};
</script>

<style scoped lang="scss">
.crew-list {
  display: flex;
  flex-direction: column;
}

.inner-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.actor-with-voice-actors {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);

  .character-name {
    font-size: 16px;
    font-weight: 600;
    color: #e0e0e0;
    margin-bottom: 8px;
    padding: 4px 8px;
    border-radius: 8px;
    display: flex;
    flex-direction: row;
    gap: 8px;
    overflow: auto;

    .name {
      display: inline-flex;
      flex: 0 0 auto;
    }
  }

  .voice-actors-section {
    // padding-left: 12px;

    .voice-actors-scroll {
      .voice-actors-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
    }
  }
}

.voice-actor-item {
  text-decoration: none;
  color: inherit;
  display: block;
}
</style>

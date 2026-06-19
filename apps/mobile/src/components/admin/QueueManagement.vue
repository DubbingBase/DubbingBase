<template>
  <div class="queue-management">
    <div class="header-row">
      <h2>Import Queue</h2>
      <ion-button size="small" fill="outline" @click="fetchQueueAndUsers">
        <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
        Refresh
      </ion-button>
    </div>

    <LoadingSpinner v-if="isLoading" />

    <div v-else-if="queueItems.length === 0" class="empty-state">
      No requests found in the import queue.
    </div>

    <div v-else class="queue-list-container">
      <ion-list>
        <ion-item-sliding v-for="item in queueItems" :key="item.id">
          <ion-item button detail class="queue-item" @click="navigateToMedia(item)">
            <ion-label>
              <div class="media-title">
                <ion-badge :color="getTypeColor(item.media_type)" class="type-badge">
                  {{ item.media_type.toUpperCase() }}
                </ion-badge>
                <span class="tmdb-id">TMDB ID: {{ item.tmdb_id }}</span>
                <span v-if="item.season_number !== null" class="season-number">
                  S{{ item.season_number }}
                </span>
                <span v-if="item.episode_number !== null" class="episode-number">
                  E{{ item.episode_number }}
                </span>
              </div>

              <div class="meta-row">
                <span class="user-info">
                  Requested by: <strong>{{ getUserEmail(item.user_id) }}</strong>
                </span>
                <span class="time-info">
                  {{ formatTime(item.created_at) }}
                </span>
              </div>

              <div v-if="item.error_message" class="error-msg">
                Error: {{ item.error_message }}
              </div>
            </ion-label>

            <ion-chip :color="getStatusColor(item.status)" slot="end">
              <ion-spinner v-if="item.status === 'processing'" name="crescent" size="small" class="chip-spinner"></ion-spinner>
              <ion-label>{{ item.status.toUpperCase() }}</ion-label>
            </ion-chip>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option
              v-if="item.status === 'failed' || item.status === 'pending'"
              color="primary"
              @click="retryFetch(item)"
            >
              <ion-icon slot="icon-only" :icon="playOutline"></ion-icon>
            </ion-item-option>
            <ion-item-option color="danger" @click="deleteRequest(item.id)">
              <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonChip,
  IonButton,
  IonIcon,
  IonSpinner,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  toastController,
} from "@ionic/vue";
import {
  refreshOutline,
  trashOutline,
  playOutline,
} from "ionicons/icons";
import { supabase } from "@/api/supabase";
import { enqueueAndProcessMedia } from "@/api/mediaQueue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { formatDistanceToNow } from "date-fns";

type QueueItem = {
  id: number;
  tmdb_id: number;
  media_type: "movie" | "tv" | "season" | "episode";
  season_number: number | null;
  episode_number: number | null;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

const router = useRouter();
const queueItems = ref<QueueItem[]>([]);
const usersMap = ref<Record<string, string>>({});
const isLoading = ref(true);

const navigateToMedia = (item: QueueItem) => {
  if (item.media_type === "movie") {
    router.push({
      name: "MovieDetails",
      params: { id: item.tmdb_id.toString() }
    });
  } else if (item.media_type === "tv") {
    router.push({
      name: "SerieDetails",
      params: { id: item.tmdb_id.toString() }
    });
  } else if (item.media_type === "season") {
    router.push({
      name: "SeasonDetails",
      params: {
        id: item.tmdb_id.toString(),
        season: item.season_number?.toString() ?? "1"
      }
    });
  } else if (item.media_type === "episode") {
    router.push({
      name: "SeasonByEpisodes",
      params: {
        id: item.tmdb_id.toString(),
        season: item.season_number?.toString() ?? "1",
        episode: item.episode_number?.toString() ?? "1"
      }
    });
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "success";
    case "processing":
      return "primary";
    case "pending":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "medium";
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case "movie":
      return "tertiary";
    case "tv":
      return "success";
    case "season":
      return "warning";
    case "episode":
      return "secondary";
    default:
      return "medium";
  }
};

const getUserEmail = (userId: string | null) => {
  if (!userId) return "Anonymous";
  return usersMap.value[userId] || `User (${userId.substring(0, 8)})`;
};

const formatTime = (timeStr: string) => {
  try {
    return formatDistanceToNow(new Date(timeStr), { addSuffix: true });
  } catch (err) {
    return timeStr;
  }
};

const fetchQueueAndUsers = async () => {
  isLoading.value = true;
  try {
    // 1. Fetch queue items using RPC helper
    const { data: queueData, error: queueErr } = await supabase
      .rpc("get_media_queue_items");

    if (queueErr) throw queueErr;
    queueItems.value = (queueData || []).map((item: any) => ({
      ...item,
      media_type: item.media_type as QueueItem["media_type"],
      status: item.status as QueueItem["status"],
    }));

    // 2. Fetch users to map user_id -> email
    const session = (await supabase.auth.getSession()).data.session;
    if (session) {
      const { data: userData, error: userErr } = await supabase.functions.invoke(
        "list_users",
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (!userErr && userData?.users) {
        const tempMap: Record<string, string> = {};
        userData.users.forEach((u: any) => {
          tempMap[u.id] = u.email;
        });
        usersMap.value = tempMap;
      }
    }
  } catch (err: any) {
    console.error("Error fetching queue or users:", err);
    const toast = await toastController.create({
      message: "Failed to load queue data: " + err.message,
      duration: 3000,
      color: "danger",
      position: "top",
    });
    await toast.present();
  } finally {
    isLoading.value = false;
  }
};

const deleteRequest = async (id: number) => {
  try {
    const { error } = await supabase
      .rpc("delete_media_queue_item", { p_id: id });

    if (error) throw error;

    queueItems.value = queueItems.value.filter((item) => item.id !== id);

    const toast = await toastController.create({
      message: "Request removed from queue.",
      duration: 2000,
      color: "success",
      position: "top",
    });
    await toast.present();
  } catch (err: any) {
    console.error("Error deleting queue request:", err);
    const toast = await toastController.create({
      message: "Failed to delete request: " + err.message,
      duration: 2000,
      color: "danger",
      position: "top",
    });
    await toast.present();
  }
};

const retryFetch = async (item: QueueItem) => {
  try {
    // Retrigger the fetch by enqueuing it again
    const toast = await toastController.create({
      message: "Re-enqueuing fetch request...",
      duration: 2000,
      color: "primary",
      position: "top",
    });
    await toast.present();

    await enqueueAndProcessMedia({
      tmdbId: item.tmdb_id,
      mediaType: item.media_type,
      seasonNumber: item.season_number,
      episodeNumber: item.episode_number,
    });

    const successToast = await toastController.create({
      message: "Request successfully re-enqueued.",
      duration: 3000,
      color: "success",
      position: "top",
    });
    await successToast.present();
  } catch (err: any) {
    console.error("Error retrying fetch:", err);
    const errToast = await toastController.create({
      message: "Failed to re-enqueue request: " + err.message,
      duration: 3000,
      color: "danger",
      position: "top",
    });
    await errToast.present();
  } finally {
    await fetchQueueAndUsers();
  }
};

onMounted(fetchQueueAndUsers);
</script>

<style scoped>
.queue-management {
  padding: 16px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--ion-color-medium);
}

.queue-list-container {
  margin-top: 8px;
}

.queue-item {
  --padding-start: 0;
  --inner-padding-end: 0;
}

.media-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 500;
  margin-bottom: 6px;
}

.type-badge {
  font-size: 0.75rem;
  padding: 3px 6px;
}

.tmdb-id {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.season-number,
.episode-number {
  background: var(--ion-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: bold;
}

.meta-row {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}

.error-msg {
  color: var(--ion-color-danger);
  font-size: 0.85rem;
  margin-top: 6px;
  white-space: normal;
}

.chip-spinner {
  margin-right: 6px;
  --color: currentColor;
}
</style>

const { createApp, ref, computed, onMounted, nextTick } = Vue;

const app = createApp({
  template: `
    <div class="relative w-full h-full flex">
      <div class="w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col flex-shrink-0">
        <div class="p-6 border-b border-slate-200">
          <div class="flex items-center gap-3 mb-2">
            <span class="iconify text-2xl text-blue-600" data-icon="mdi:globe"></span>
            <h1 class="text-xl font-bold text-slate-900">浏览器管理</h1>
          </div>
          <p class="text-xs text-slate-500">v1.0.0</p>
        </div>

        <nav class="flex-1 p-4 space-y-2">
          <button @click="currentPage = 'dashboard'" :class="navButtonClass('dashboard')" class="w-full px-4 py-3 rounded-lg font-semibold hover:bg-blue-100 transition flex items-center gap-3">
            <span class="iconify" data-icon="mdi:view-dashboard"></span>
            仪表盘
          </button>
          <button @click="currentPage = 'profiles'" :class="navButtonClass('profiles')" class="w-full px-4 py-3 rounded-lg font-semibold hover:bg-slate-100 transition flex items-center gap-3">
            <span class="iconify" data-icon="mdi:format-list-bulleted"></span>
            配置列表
          </button>
          <button @click="currentPage = 'create'" :class="navButtonClass('create')" class="w-full px-4 py-3 rounded-lg font-semibold hover:bg-slate-100 transition flex items-center gap-3">
            <span class="iconify" data-icon="mdi:plus-circle"></span>
            新建配置
          </button>
          <button @click="currentPage = 'groups'" :class="navButtonClass('groups')" class="w-full px-4 py-3 rounded-lg font-semibold hover:bg-slate-100 transition flex items-center gap-3">
            <span class="iconify" data-icon="mdi:folder-multiple"></span>
            分组管理
          </button>
          <button @click="currentPage = 'settings'" :class="navButtonClass('settings')" class="w-full px-4 py-3 rounded-lg font-semibold hover:bg-slate-100 transition flex items-center gap-3">
            <span class="iconify" data-icon="mdi:cog"></span>
            设置
          </button>
        </nav>

        <div class="p-4 border-t border-slate-200">
          <p class="text-xs text-slate-500 text-center">独立隔离 · 零数据泄露</p>
        </div>
      </div>

      <div class="flex-1 flex flex-col overflow-hidden">
        <div class="flex-1 p-8 overflow-y-auto">
          <div v-if="alertMessage" :class="alertClass" class="mb-6 p-4 rounded-2xl border shadow flex items-center gap-2">
            <span v-if="alertMessage.startsWith('✓')" class="iconify text-xl" data-icon="mdi:check-circle"></span>
            <span v-if="alertMessage.startsWith('✗')" class="iconify text-xl" data-icon="mdi:close-circle"></span>
            <span v-if="!alertMessage.startsWith('✓') && !alertMessage.startsWith('✗')" class="iconify text-xl" data-icon="mdi:information"></span>
            <p>{{ alertMessage.replace('✓', '').replace('✗', '').trim() }}</p>
          </div>

          <DashboardPage v-if="currentPage === 'dashboard'" 
            key="dashboard"
            :profiles="profiles" 
            :groups="groups"
            :running-profiles="runningProfiles"
            @reload="loadAll"
            @open="openProfile"
            @close="closeProfile"
          />
          <ProfilesPage v-if="currentPage === 'profiles'" 
            key="profiles"
            :profiles="profiles" 
            :groups="groups"
            :running-profiles="runningProfiles"
            @reload="loadAll" 
          />
          <CreatePage v-if="currentPage === 'create'" 
            key="create"
            :groups="groups"
            @reload="loadAll"
          />
          <GroupsPage v-if="currentPage === 'groups'" 
            key="groups"
            :groups="groups"
            :profiles="profiles"
            @reload="loadAll"
          />
          <SettingsPage v-if="currentPage === 'settings'" key="settings" :stats="stats" />
        </div>
      </div>

      <EditProfileModal v-if="editingProfile" :profile="editingProfile" :groups="groups" @close="editingProfile = null" @save="saveProfileEdit" />
      <EditGroupModal v-if="editingGroup" :group="editingGroup" @close="editingGroup = null" @save="saveGroupEdit" />
    </div>
  `,

  components: {
    DashboardPage: {
      template: `
        <div class="max-w-7xl">
          <div class="mb-8">
            <h2 class="text-3xl font-bold text-slate-900">仪表盘</h2>
            <p class="text-slate-600">浏览器账号管理器概览</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-white rounded-2xl shadow-lg p-6 border border-blue-50">
              <div class="text-xs uppercase tracking-widest text-slate-500 mb-2">总配置数</div>
              <div class="text-4xl font-bold text-slate-900">{{ profiles.length }}</div>
            </div>
            <div class="bg-white rounded-2xl shadow-lg p-6 border border-green-50">
              <div class="text-xs uppercase tracking-widest text-slate-500 mb-2">运行中</div>
              <div class="text-4xl font-bold text-green-600">{{ runningProfiles.length }}</div>
            </div>
            <div class="bg-white rounded-2xl shadow-lg p-6 border border-purple-50">
              <div class="text-xs uppercase tracking-widest text-slate-500 mb-2">总分组数</div>
              <div class="text-4xl font-bold text-slate-900">{{ groups.length }}</div>
            </div>
            <div class="bg-white rounded-2xl shadow-lg p-6 border border-amber-50">
              <div class="text-xs uppercase tracking-widest text-slate-500 mb-2">星标收藏</div>
              <div class="text-4xl font-bold text-amber-600">{{ profiles.filter(p => p.starred).length }}</div>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-lg p-6 border border-blue-50 mb-8">
            <h3 class="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span class="iconify" data-icon="mdi:clock-outline"></span>
              最近使用
            </h3>
            <div v-if="recentProfiles.length === 0" class="text-center py-12 text-slate-400">
              <span class="iconify text-6xl" data-icon="mdi:inbox"></span>
              <p class="text-lg font-medium mt-4">暂无使用记录</p>
            </div>
            <div v-else class="space-y-3">
              <div v-for="profile in recentProfiles" :key="profile.name" class="border border-slate-200 bg-white rounded-xl p-4 hover:shadow-lg transition">
                <div class="flex items-center gap-4">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <div class="font-bold text-slate-900 truncate text-lg">{{ profile.name }}</div>
                      <span v-if="isRunning(profile.name)" class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                    </div>
                    <div class="text-sm text-slate-600 mt-1">
                      <span class="iconify" :data-icon="profile.browserType === 'firefox' ? 'mdi:firefox' : 'logos:chrome'"></span>
                      {{ profile.browserType === 'firefox' ? 'Firefox' : 'Chromium' }}
                      <span class="text-slate-400 ml-2">{{ formatDate(profile.lastUsed) }}</span>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button v-if="isRunning(profile.name)" @click="$emit('close', profile.name)" class="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition">
                      关闭
                    </button>
                    <button v-else @click="$emit('open', profile.name)" class="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-sky-500 text-white font-semibold text-sm hover:shadow-md transition">
                      打开
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-lg p-6 border border-blue-50">
            <h3 class="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span class="iconify" data-icon="mdi:star"></span>
              星标收藏
            </h3>
            <div v-if="starredProfiles.length === 0" class="text-center py-12 text-slate-400">
              <span class="iconify text-6xl" data-icon="mdi:star-outline"></span>
              <p class="text-lg font-medium mt-4">暂无星标配置</p>
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-for="profile in starredProfiles" :key="profile.name" class="border border-slate-200 bg-white rounded-xl p-4 hover:shadow-lg transition">
                <div class="flex items-center gap-4">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-xl">⭐</span>
                      <div class="font-bold text-slate-900 truncate">{{ profile.name }}</div>
                    </div>
                    <div class="text-sm text-slate-600 mt-1">
                      <span class="iconify" :data-icon="profile.browserType === 'firefox' ? 'mdi:firefox' : 'logos:chrome'"></span>
                      {{ profile.browserType === 'firefox' ? 'Firefox' : 'Chromium' }}
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button v-if="isRunning(profile.name)" @click="$emit('close', profile.name)" class="px-3 py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition">
                      关闭
                    </button>
                    <button v-else @click="$emit('open', profile.name)" class="px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition">
                      打开
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      props: ['profiles', 'groups', 'runningProfiles'],
      emits: ['reload', 'open', 'close'],
      computed: {
        recentProfiles() {
          return this.profiles
            .filter(p => p.lastUsed)
            .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
            .slice(0, 5);
        },
        starredProfiles() {
          return this.profiles.filter(p => p.starred);
        }
      },
      methods: {
        isRunning(name) {
          return this.runningProfiles.includes(name);
        },
        formatDate(dateStr) {
          if (!dateStr) return '';
          const date = new Date(dateStr);
          const now = new Date();
          const diff = now - date;
          const minutes = Math.floor(diff / 60000);
          if (minutes < 1) return '刚刚';
          if (minutes < 60) return minutes + '分钟前';
          const hours = Math.floor(minutes / 60);
          if (hours < 24) return hours + '小时前';
          const days = Math.floor(hours / 24);
          if (days < 7) return days + '天前';
          return date.toLocaleDateString();
        }
      }
    },

    ProfilesPage: {
      template: `
        <div class="max-w-7xl">
          <div class="mb-8 flex items-center justify-between">
            <h2 class="text-3xl font-bold text-slate-900">配置列表</h2>
            <div class="flex gap-2">
              <button v-if="selectedProfiles.length > 0" @click="batchExport" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2">
                <span class="iconify" data-icon="mdi:export"></span>
                批量导出 ({{ selectedProfiles.length }})
              </button>
              <button v-if="selectedProfiles.length > 0" @click="batchDelete" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-2">
                <span class="iconify" data-icon="mdi:delete"></span>
                批量删除 ({{ selectedProfiles.length }})
              </button>
              <button @click="showImportDialog" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2">
                <span class="iconify" data-icon="mdi:import"></span>
                导入配置
              </button>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-lg p-6 border border-blue-50 mb-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input @input="updateSearch($event.target.value)" placeholder="搜索配置名称或备注..." class="px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
              <select @change="updateFilter('group', $event.target.value)" class="px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                <option value="">所有分组</option>
                <option value="__starred__">⭐ 星标收藏</option>
                <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
              </select>
              <select @change="updateFilter('type', $event.target.value)" class="px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                <option value="">所有浏览器</option>
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
              </select>
            </div>
          </div>

          <div class="mb-6 flex items-center gap-4">
            <button @click="viewMode = 'list'" :class="viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'" class="px-4 py-2 rounded-lg hover:shadow transition flex items-center gap-2">
              <span class="iconify" data-icon="mdi:view-list"></span>
              列表
            </button>
            <button @click="viewMode = 'card'" :class="viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'" class="px-4 py-2 rounded-lg hover:shadow transition flex items-center gap-2">
              <span class="iconify" data-icon="mdi:view-grid"></span>
              卡片
            </button>
            <div class="flex-1"></div>
            <select @change="sortBy = $event.target.value" v-model="sortBy" class="px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
              <option value="name">按名称排序</option>
              <option value="created">按创建时间</option>
              <option value="lastUsed">按最近使用</option>
              <option value="useCount">按使用次数</option>
            </select>
            <button @click="$emit('reload')" class="px-4 py-2 bg-white text-slate-600 rounded-lg hover:shadow transition flex items-center gap-2">
              <span class="iconify" data-icon="mdi:refresh"></span>
              刷新
            </button>
          </div>

          <div class="bg-white rounded-2xl shadow-lg p-6 border border-blue-50">
            <h3 class="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span class="iconify" data-icon="mdi:list"></span>
              配置列表
            </h3>
            <div v-if="filteredProfiles.length === 0" class="text-center py-12 text-slate-400">
              <span class="iconify text-6xl" data-icon="mdi:inbox"></span>
              <p class="text-lg font-medium mt-4">暂无匹配配置</p>
              <p class="text-sm mt-2">尝试更改搜索或筛选条件</p>
            </div>
            <ProfileList v-else :profiles="filteredProfiles" :running-profiles="runningProfiles" :groups="groups" :view-mode="viewMode" :selected-profiles="selectedProfiles" @toggle-select="toggleSelect" @open="openProfile" @close="closeProfile" @edit="editProfile" @delete="deleteProfile" @toggle-star="toggleStar" @export="exportProfile" @regenerate-fingerprint="regenerateFingerprint" @clone="cloneProfile" />
          </div>
        </div>
      `,
      props: ['profiles', 'groups', 'runningProfiles'],
      emits: ['reload'],
      data() {
        return {
          searchQuery: '',
          filterGroup: '',
          filterType: '',
          viewMode: 'list',
          selectedProfiles: [],
          sortBy: 'name'
        };
      },
      computed: {
        filteredProfiles() {
          let filtered = [...this.profiles];
          
          if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(p => 
              p.name.toLowerCase().includes(q) || 
              (p.notes && p.notes.toLowerCase().includes(q))
            );
          }
          
          if (this.filterType) {
            filtered = filtered.filter(p => p.browserType === this.filterType);
          }
          
          if (this.filterGroup === '__starred__') {
            filtered = filtered.filter(p => p.starred);
          } else if (this.filterGroup) {
            filtered = filtered.filter(p => p.group === this.filterGroup);
          }
          
          filtered.sort((a, b) => {
            if (a.starred !== b.starred) return a.starred ? -1 : 1;
            
            switch (this.sortBy) {
              case 'name':
                return a.name.localeCompare(b.name);
              case 'created':
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
              case 'lastUsed':
                if (!a.lastUsed && !b.lastUsed) return 0;
                if (!a.lastUsed) return 1;
                if (!b.lastUsed) return -1;
                return new Date(b.lastUsed) - new Date(a.lastUsed);
              case 'useCount':
                return (b.useCount || 0) - (a.useCount || 0);
              default:
                return a.name.localeCompare(b.name);
            }
          });
          
          return filtered;
        }
      },
      methods: {
        updateSearch(query) {
          this.searchQuery = query;
        },
        updateFilter(type, value) {
          if (type === 'group') {
            this.filterGroup = value;
          } else if (type === 'type') {
            this.filterType = value;
          }
        },
        toggleSelect(name) {
          const index = this.selectedProfiles.indexOf(name);
          if (index > -1) {
            this.selectedProfiles.splice(index, 1);
          } else {
            this.selectedProfiles.push(name);
          }
        },
        async openProfile(name) {
          const result = await window.api.openProfile(name);
          if (result.error) {
            alert('打开失败: ' + result.error);
          } else {
            this.$emit('reload');
          }
        },
        async closeProfile(name) {
          const result = await window.api.closeProfile(name);
          if (result.error) {
            alert('关闭失败: ' + result.error);
          } else {
            this.$emit('reload');
          }
        },
        editProfile(profile) {
          this.$root.editingProfile = profile;
        },
        async deleteProfile(name) {
          if (!confirm('确定要删除配置 "' + name + '" 吗？')) return;
          const result = await window.api.deleteProfile(name);
          if (result.error) {
            alert('删除失败: ' + result.error);
          } else {
            this.$emit('reload');
          }
        },
        async toggleStar(name, starred) {
          const result = await window.api.updateProfile(name, { starred: !starred });
          if (result.error) {
            alert('更新失败: ' + result.error);
          } else {
            this.$emit('reload');
          }
        },
        async exportProfile(name) {
          const result = await window.api.exportProfile(name);
          if (result.error) {
            alert('导出失败: ' + result.error);
          } else {
            const json = JSON.stringify(result.config, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name + '.json';
            a.click();
          }
        },
        async regenerateFingerprint(name) {
          if (!confirm('重新生成指纹后，网站可能会识别为新设备。确定继续？')) return;
          const result = await window.api.regenerateFingerprint(name);
          if (result.error) {
            alert('重新生成失败: ' + result.error);
          } else {
            alert('指纹已重新生成');
            this.$emit('reload');
          }
        },
        async cloneProfile(name) {
          const newName = prompt('请输入新配置名称:', name + '-副本');
          if (!newName) return;
          
          const exportResult = await window.api.exportProfile(name);
          if (exportResult.error) {
            alert('克隆失败: ' + exportResult.error);
            return;
          }
          
          const result = await window.api.importProfile(newName, exportResult.config);
          if (result.error) {
            alert('克隆失败: ' + result.error);
          } else {
            alert('✓ 配置已克隆');
            this.$emit('reload');
          }
        },
        async batchExport() {
          if (this.selectedProfiles.length === 0) return;
          
          const exports = [];
          for (const name of this.selectedProfiles) {
            const result = await window.api.exportProfile(name);
            if (!result.error) {
              exports.push({
                name: name,
                config: result.config
              });
            }
          }
          
          if (exports.length === 0) {
            alert('没有可导出的配置');
            return;
          }
          
          const json = JSON.stringify(exports, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `profiles-export-${Date.now()}.json`;
          a.click();
          alert(`✓ 已导出 ${exports.length} 个配置`);
        },
        async batchDelete() {
          if (!confirm('确定要删除选中的 ' + this.selectedProfiles.length + ' 个配置吗？')) return;
          const result = await window.api.batchDeleteProfiles(this.selectedProfiles);
          if (result.error) {
            alert('批量删除失败: ' + result.error);
          } else {
            this.selectedProfiles = [];
            this.$emit('reload');
          }
        },
        showImportDialog() {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
              try {
                const config = JSON.parse(event.target.result);
                const name = prompt('请输入配置名称:', config.name || '');
                if (!name) return;
                const result = await window.api.importProfile(name, config);
                if (result.error) {
                  alert('导入失败: ' + result.error);
                } else {
                  alert('导入成功');
                  this.$emit('reload');
                }
              } catch (error) {
                alert('导入失败: ' + error.message);
              }
            };
            reader.readAsText(file);
          };
          input.click();
        }
      }
    },

    CreatePage: {
      template: `
        <div class="max-w-4xl mx-auto">
          <div class="mb-8">
            <h2 class="text-3xl font-bold text-slate-900">新建配置</h2>
            <p class="text-slate-600">创建一个新的浏览器配置</p>
          </div>

          <div class="bg-white rounded-2xl shadow-lg p-8 border border-blue-50">
            <div class="space-y-6">
              <div class="border-b border-slate-200 pb-6">
                <h3 class="text-xl font-bold text-slate-900 mb-4">基础信息</h3>
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-slate-600 mb-2">配置名称</label>
                    <input v-model="form.name" placeholder="输入配置名称..." class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-slate-600 mb-2">浏览器类型</label>
                      <select v-model="form.type" class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                        <option value="chromium">Chromium</option>
                        <option value="firefox">Firefox</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-slate-600 mb-2">分组</label>
                      <select v-model="form.group" class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                        <option value="">未分组</option>
                        <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-600 mb-2">备注</label>
                    <textarea v-model="form.notes" placeholder="可选..." rows="3" class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"></textarea>
                  </div>
                </div>
              </div>

              <div class="border-b border-slate-200 pb-6">
                <h3 class="text-xl font-bold text-slate-900 mb-4">高级设置</h3>
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-slate-600 mb-2">启动 URL</label>
                    <input v-model="form.startUrl" placeholder="https://example.com" class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-600 mb-2">自定义启动参数</label>
                    <input v-model="form.customArgs" placeholder="--flag1 --flag2" class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                  </div>
                </div>
              </div>

              <div class="border-b border-slate-200 pb-6">
                <h3 class="text-xl font-bold text-slate-900 mb-4">代理配置</h3>
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-slate-600 mb-2">代理服务器</label>
                    <input v-model="form.proxyServer" placeholder="http://proxy.com:8080" class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-slate-600 mb-2">用户名</label>
                      <input v-model="form.proxyUsername" placeholder="可选" class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-slate-600 mb-2">密码</label>
                      <input v-model="form.proxyPassword" type="password" placeholder="可选" class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-xl font-bold text-slate-900 mb-4">其他选项</h3>
                <div class="space-y-3">
                  <label class="flex items-center gap-3 cursor-pointer">
                    <input v-model="form.enableFingerprint" type="checkbox" class="w-5 h-5 text-blue-600 rounded">
                    <div>
                      <p class="font-medium text-slate-900">启用指纹保护</p>
                      <p class="text-sm text-slate-500">自动生成浏览器指纹防止追踪</p>
                    </div>
                  </label>
                  <label class="flex items-center gap-3 cursor-pointer">
                    <input v-model="form.starred" type="checkbox" class="w-5 h-5 text-blue-600 rounded">
                    <div>
                      <p class="font-medium text-slate-900">标记为星标</p>
                      <p class="text-sm text-slate-500">在仪表盘快速访问</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div class="mt-8 flex gap-4">
              <button @click="create" class="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-lg rounded-lg hover:shadow-lg transition">
                创建配置
              </button>
              <button @click="reset" class="px-6 py-4 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition">
                重置
              </button>
            </div>
          </div>
        </div>
      `,
      props: ['groups'],
      emits: ['reload'],
      data() {
        return {
          form: {
            name: '',
            type: 'chromium',
            group: '',
            notes: '',
            startUrl: '',
            customArgs: '',
            proxyServer: '',
            proxyUsername: '',
            proxyPassword: '',
            enableFingerprint: true,
            starred: false
          }
        };
      },
      methods: {
        async create() {
          if (!this.form.name.trim()) {
            alert('请输入配置名称');
            return;
          }

          const options = {
            browserType: this.form.type,
            group: this.form.group,
            notes: this.form.notes,
            startUrl: this.form.startUrl,
            customArgs: this.form.customArgs,
            enableFingerprint: this.form.enableFingerprint,
            starred: this.form.starred
          };

          if (this.form.proxyServer) {
            options.proxy = {
              server: this.form.proxyServer,
              username: this.form.proxyUsername,
              password: this.form.proxyPassword
            };
          }

          const result = await window.api.createProfile(this.form.name, options);
          if (result.error) {
            alert('创建失败: ' + result.error);
          } else {
            alert('✓ 配置创建成功');
            this.reset();
            this.$emit('reload');
          }
        },
        reset() {
          this.form = {
            name: '',
            type: 'chromium',
            group: '',
            notes: '',
            startUrl: '',
            customArgs: '',
            proxyServer: '',
            proxyUsername: '',
            proxyPassword: '',
            enableFingerprint: true,
            starred: false
          };
        }
      }
    },

    GroupsPage: {
      template: `
        <div class="max-w-7xl">
          <div class="mb-8">
            <h2 class="text-3xl font-bold text-slate-900">分组管理</h2>
            <p class="text-slate-600">创建和管理配置分组</p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div class="bg-white rounded-2xl shadow-lg p-6 border border-blue-50">
              <h3 class="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span class="iconify" data-icon="mdi:plus-circle"></span>
                创建新分组
              </h3>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-slate-600 mb-2">分组名称</label>
                  <input v-model="form.name" placeholder="输入分组名称..." class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-600 mb-2">分组颜色</label>
                  <select v-model="form.color" class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                    <option value="blue">蓝色</option>
                    <option value="green">绿色</option>
                    <option value="red">红色</option>
                    <option value="purple">紫色</option>
                    <option value="amber">黄色</option>
                    <option value="pink">粉色</option>
                    <option value="cyan">青色</option>
                  </select>
                </div>
                <button @click="createGroup" class="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold rounded-lg hover:shadow-lg transition">
                  创建分组
                </button>
              </div>
            </div>

            <div class="bg-white rounded-2xl shadow-lg p-6 border border-blue-50">
              <h3 class="text-xl font-bold text-slate-900 mb-4">分组统计</h3>
              <div class="space-y-3">
                <div class="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span class="font-medium text-slate-700">总分组数</span>
                  <span class="text-2xl font-bold text-blue-600">{{ groups.length }}</span>
                </div>
                <div class="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <span class="font-medium text-slate-700">总配置数</span>
                  <span class="text-2xl font-bold text-purple-600">{{ profiles.length }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-lg p-6 border border-blue-50">
            <h3 class="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span class="iconify" data-icon="mdi:folder-multiple"></span>
              所有分组
            </h3>
            <div v-if="groups.length === 0" class="text-center py-12 text-slate-400">
              <span class="iconify text-6xl" data-icon="mdi:folder-outline"></span>
              <p class="text-lg font-medium mt-4">暂无分组</p>
              <p class="text-sm mt-2">创建第一个分组来组织你的配置</p>
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div v-for="group in groups" :key="group.id" class="border-2 border-slate-200 rounded-xl p-6 hover:shadow-lg transition">
                <div class="flex items-center gap-3 mb-4">
                  <div :class="'w-6 h-6 rounded-full bg-' + group.color + '-500'"></div>
                  <div class="font-bold text-slate-900 text-lg flex-1">{{ group.name }}</div>
                </div>
                <div class="text-sm text-slate-600 mb-4">
                  配置数量: {{ getGroupProfileCount(group.id) }}
                </div>
                <div class="flex gap-2">
                  <button @click="editGroup(group)" class="flex-1 px-3 py-2 rounded-lg bg-blue-100 text-blue-700 text-sm font-semibold hover:bg-blue-200 transition">
                    编辑
                  </button>
                  <button @click="deleteGroup(group.id)" class="flex-1 px-3 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-semibold hover:bg-red-200 transition">
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      props: ['groups', 'profiles'],
      emits: ['reload'],
      data() {
        return {
          form: {
            name: '',
            color: 'blue'
          }
        };
      },
      methods: {
        async createGroup() {
          if (!this.form.name.trim()) {
            alert('请输入分组名称');
            return;
          }
          const result = await window.api.createGroup(this.form.name, this.form.color);
          if (result.error) {
            alert('创建失败: ' + result.error);
          } else {
            alert('✓ 分组创建成功');
            this.form.name = '';
            this.form.color = 'blue';
            this.$emit('reload');
          }
        },
        async deleteGroup(id) {
          if (!confirm('确定要删除该分组吗？配置不会被删除。')) return;
          const result = await window.api.deleteGroup(id);
          if (result.error) {
            alert('删除失败: ' + result.error);
          } else {
            alert('✓ 分组已删除');
            this.$emit('reload');
          }
        },
        editGroup(group) {
          this.$root.editingGroup = group;
        },
        getGroupProfileCount(groupId) {
          return this.profiles.filter(p => p.group === groupId).length;
        }
      }
    },

    ProfileList: {
      template: `
        <div :class="viewMode === 'list' ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 gap-4'">
          <div v-for="profile in profiles" :key="profile.name" :class="viewMode === 'list' ? 'profileListItem' : 'profileCardItem'">
            <div class="flex items-center gap-4">
              <input type="checkbox" :checked="selectedProfiles.includes(profile.name)" @change="$emit('toggle-select', profile.name)" class="w-5 h-5 text-blue-600 rounded">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <button @click="$emit('toggle-star', profile.name, profile.starred)" class="text-xl">
                    {{ profile.starred ? '⭐' : '☆' }}
                  </button>
                  <div class="font-bold text-slate-900 truncate text-lg">{{ profile.name }}</div>
                  <span v-if="isRunning(profile.name)" class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                </div>
                <div class="text-sm text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                  <span class="iconify" :data-icon="profile.browserType === 'firefox' ? 'mdi:firefox' : 'logos:chrome'"></span>
                  {{ profile.browserType === 'firefox' ? 'Firefox' : 'Chromium' }}
                  <span v-if="profile.group" :class="getGroupStyle(profile.group)" class="px-2 py-1 rounded-full text-xs font-semibold">{{ getGroupName(profile.group) }}</span>
                  <span v-if="profile.proxy" class="text-xs text-purple-600 px-2 py-1 bg-purple-50 rounded flex items-center gap-1">
                    <span class="iconify" data-icon="mdi:web"></span> 代理
                  </span>
                  <span v-if="profile.startUrl" class="text-xs text-green-600 px-2 py-1 bg-green-50 rounded flex items-center gap-1">
                    <span class="iconify" data-icon="mdi:rocket-launch"></span> 启动URL
                  </span>
                  <span v-if="profile.enableFingerprint !== false" class="text-xs text-blue-600 px-2 py-1 bg-blue-50 rounded flex items-center gap-1">
                    <span class="iconify" data-icon="mdi:fingerprint"></span> 指纹
                  </span>
                </div>
                <div v-if="profile.notes" class="text-xs text-slate-500 mt-1">{{ profile.notes }}</div>
                <div class="text-xs text-slate-400 mt-1">
                  使用 {{ profile.useCount || 0 }} 次
                  <span v-if="profile.lastUsed"> · 最后使用: {{ formatDate(profile.lastUsed) }}</span>
                </div>
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <button v-if="isRunning(profile.name)" @click="$emit('close', profile.name)" class="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition">
                  关闭
                </button>
                <button v-else @click="$emit('open', profile.name)" class="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-sky-500 text-white font-semibold text-sm hover:shadow-md transition">
                  打开
                </button>
                <button @click="showMenu(profile, $event)" class="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-300 transition">
                  <span class="iconify" data-icon="mdi:dots-vertical"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `,
      props: ['profiles', 'runningProfiles', 'groups', 'viewMode', 'selectedProfiles'],
      emits: ['toggle-select', 'open', 'close', 'edit', 'delete', 'toggle-star', 'export', 'regenerate-fingerprint', 'clone'],
      methods: {
        isRunning(name) {
          return this.runningProfiles.includes(name);
        },
        getGroupName(groupId) {
          const group = this.groups.find(g => g.id === groupId);
          return group ? group.name : '';
        },
        getGroupStyle(groupId) {
          const group = this.groups.find(g => g.id === groupId);
          if (!group) return '';
          const colorMap = {
            blue: 'bg-blue-100 text-blue-700',
            green: 'bg-green-100 text-green-700',
            red: 'bg-red-100 text-red-700',
            purple: 'bg-purple-100 text-purple-700',
            amber: 'bg-amber-100 text-amber-700',
            pink: 'bg-pink-100 text-pink-700',
            cyan: 'bg-cyan-100 text-cyan-700'
          };
          return colorMap[group.color] || colorMap.blue;
        },
        formatDate(dateStr) {
          if (!dateStr) return '';
          const date = new Date(dateStr);
          const now = new Date();
          const diff = now - date;
          const minutes = Math.floor(diff / 60000);
          if (minutes < 1) return '刚刚';
          if (minutes < 60) return minutes + '分钟前';
          const hours = Math.floor(minutes / 60);
          if (hours < 24) return hours + '小时前';
          const days = Math.floor(hours / 24);
          if (days < 7) return days + '天前';
          return date.toLocaleDateString();
        },
        showMenu(profile, event) {
          const menu = [
            { label: '编辑', action: () => this.$emit('edit', profile) },
            { label: '克隆配置', action: () => this.$emit('clone', profile.name) },
            { label: '导出配置', action: () => this.$emit('export', profile.name) },
            { label: '重新生成指纹', action: () => this.$emit('regenerate-fingerprint', profile.name) },
            { label: '删除', action: () => this.$emit('delete', profile.name), danger: true }
          ];
          
          const menuHtml = menu.map((item, i) => 
            `<button onclick="window.__menuAction(${i})" class="w-full text-left px-4 py-2 hover:bg-slate-100 ${item.danger ? 'text-red-600' : ''}">${item.label}</button>`
          ).join('');
          
          const div = document.createElement('div');
          div.innerHTML = `<div class="fixed bg-white rounded-lg shadow-xl border border-slate-200 z-50">${menuHtml}</div>`;
          div.style.cssText = `position: fixed; left: ${event.clientX}px; top: ${event.clientY}px; z-index: 1000;`;
          document.body.appendChild(div);
          
          window.__menuAction = (index) => {
            menu[index].action();
            document.body.removeChild(div);
            delete window.__menuAction;
          };
          
          const closeMenu = () => {
            if (document.body.contains(div)) {
              document.body.removeChild(div);
              delete window.__menuAction;
            }
            document.removeEventListener('click', closeMenu);
          };
          setTimeout(() => document.addEventListener('click', closeMenu), 100);
        }
      }
    },

    EditProfileModal: {
      template: `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('close')">
          <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div class="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 class="text-2xl font-bold text-slate-900">编辑配置</h2>
              <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600">
                <span class="iconify text-2xl" data-icon="mdi:close"></span>
              </button>
            </div>
            <div class="p-6 space-y-6">
              <div>
                <label class="block text-sm font-medium text-slate-600 mb-2">配置名称</label>
                <input v-model="form.newName" class="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-600 mb-2">分组</label>
                <select v-model="form.group" class="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                  <option value="">未分组</option>
                  <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-600 mb-2">备注</label>
                <textarea v-model="form.notes" rows="3" class="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"></textarea>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-600 mb-2">代理服务器</label>
                <input v-model="form.proxyServer" placeholder="http://proxy.com:8080" class="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                <div class="grid grid-cols-2 gap-4 mt-2">
                  <input v-model="form.proxyUsername" placeholder="用户名（可选）" class="px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                  <input v-model="form.proxyPassword" type="password" placeholder="密码（可选）" class="px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-600 mb-2">启动 URL</label>
                <input v-model="form.startUrl" placeholder="https://example.com" class="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-600 mb-2">自定义启动参数</label>
                <input v-model="form.customArgs" placeholder="--flag1 --flag2" class="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
              </div>
            </div>
            <div class="p-6 border-t border-slate-200 flex gap-4 sticky bottom-0 bg-white">
              <button @click="save" class="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition">
                保存
              </button>
              <button @click="$emit('close')" class="px-4 py-3 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition">
                取消
              </button>
            </div>
          </div>
        </div>
      `,
      props: ['profile', 'groups'],
      emits: ['close', 'save'],
      data() {
        return {
          form: {
            newName: this.profile.name,
            group: this.profile.group || '',
            notes: this.profile.notes || '',
            proxyServer: this.profile.proxy?.server || '',
            proxyUsername: this.profile.proxy?.username || '',
            proxyPassword: this.profile.proxy?.password || '',
            startUrl: this.profile.startUrl || '',
            customArgs: this.profile.customArgs || ''
          }
        };
      },
      methods: {
        async save() {
          const updates = {
            group: this.form.group,
            notes: this.form.notes,
            startUrl: this.form.startUrl,
            customArgs: this.form.customArgs
          };
          
          if (this.form.proxyServer) {
            updates.proxy = {
              server: this.form.proxyServer,
              username: this.form.proxyUsername,
              password: this.form.proxyPassword
            };
          } else {
            updates.proxy = null;
          }
          
          this.$emit('save', {
            oldName: this.profile.name,
            newName: this.form.newName,
            updates
          });
        }
      }
    },

    EditGroupModal: {
      template: `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('close')">
          <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full m-4">
            <div class="p-6 border-b border-slate-200">
              <h2 class="text-2xl font-bold text-slate-900">编辑分组</h2>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-600 mb-2">分组名称</label>
                <input v-model="form.name" class="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-600 mb-2">分组颜色</label>
                <select v-model="form.color" class="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                  <option value="blue">蓝色</option>
                  <option value="green">绿色</option>
                  <option value="red">红色</option>
                  <option value="purple">紫色</option>
                  <option value="amber">黄色</option>
                  <option value="pink">粉色</option>
                  <option value="cyan">青色</option>
                </select>
              </div>
            </div>
            <div class="p-6 border-t border-slate-200 flex gap-4">
              <button @click="save" class="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition">
                保存
              </button>
              <button @click="$emit('close')" class="px-4 py-3 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition">
                取消
              </button>
            </div>
          </div>
        </div>
      `,
      props: ['group'],
      emits: ['close', 'save'],
      data() {
        return {
          form: {
            name: this.group.name,
            color: this.group.color
          }
        };
      },
      methods: {
        save() {
          this.$emit('save', {
            id: this.group.id,
            updates: { ...this.form }
          });
        }
      }
    },

    SettingsPage: {
      template: `
        <div class="max-w-4xl">
          <div class="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border border-blue-50">
            <div class="flex items-center gap-3 mb-6">
              <span class="iconify" data-icon="mdi:cog"></span>
              <h2 class="text-2xl font-bold text-slate-900">应用设置</h2>
            </div>

            <div class="space-y-6">
              <div class="border-b border-slate-200 pb-6">
                <h3 class="text-lg font-semibold text-slate-900 mb-2">关于应用</h3>
                <div class="space-y-2 text-slate-600">
                  <p><span class="font-semibold">版本</span> v1.0.0</p>
                  <p><span class="font-semibold">描述</span> 独立隔离的多浏览器账号管理工具</p>
                  <p><span class="font-semibold">特性</span> 完整隔离、零数据泄露、内置指纹识别保护</p>
                </div>
              </div>

              <div class="border-b border-slate-200 pb-6">
                <h3 class="text-lg font-semibold text-slate-900 mb-3">数据存储位置</h3>
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm text-slate-700 break-all">
                  ~/.browser-manager/profiles/
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm text-slate-700 break-all mt-2">
                  ~/.browser-manager/groups.json
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-slate-900 mb-3">支持的浏览器</h3>
                <div class="space-y-2">
                  <div class="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <span class="iconify text-2xl text-blue-600" data-icon="logos:chrome"></span>
                    <div>
                      <p class="font-semibold text-slate-900">Chromium</p>
                      <p class="text-sm text-slate-600">完全隔离的Chromium内核浏览器</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                    <span class="iconify text-2xl text-amber-600" data-icon="mdi:firefox"></span>
                    <div>
                      <p class="font-semibold text-slate-900">Firefox</p>
                      <p class="text-sm text-slate-600">完全隔离的Firefox浏览器</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      props: ['stats']
    }
  },

  setup() {
    const currentPage = ref('dashboard');
    const profiles = ref([]);
    const groups = ref([]);
    const runningProfiles = ref([]);
    const alertMessage = ref('');
    const editingProfile = ref(null);
    const editingGroup = ref(null);

    const stats = computed(() => ({
      totalProfiles: profiles.value.length,
      totalGroups: groups.value.length,
      chromiumCount: profiles.value.filter(p => p.browserType === 'chromium').length
    }));

    const alertClass = computed(() => {
      if (!alertMessage.value) return 'hidden';
      if (alertMessage.value.startsWith('✓')) return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      if (alertMessage.value.startsWith('✗')) return 'bg-rose-50 border-rose-200 text-rose-700';
      return 'bg-blue-50 border-blue-200 text-blue-700';
    });

    const navButtonClass = (page) => {
      const base = 'transition';
      if (currentPage.value === page) {
        return base + ' bg-blue-50 text-blue-600';
      }
      return base + ' text-slate-600 hover:bg-slate-100';
    };

    const showAlert = (message, duration = 3500) => {
      alertMessage.value = message;
      setTimeout(() => {
        alertMessage.value = '';
      }, duration);
    };

    const loadProfiles = async () => {
      try {
        const result = await window.api.listProfiles();
        if (result.error) {
          showAlert('✗ 加载配置失败: ' + result.error);
          profiles.value = [];
        } else {
          profiles.value = result || [];
        }
      } catch (error) {
        showAlert('✗ 加载配置出错: ' + error.message);
        profiles.value = [];
      }
    };

    const loadGroups = async () => {
      try {
        const result = await window.api.listGroups();
        if (result.error) {
          showAlert('✗ 加载分组失败: ' + result.error);
          groups.value = [];
        } else {
          groups.value = result.groups || [];
        }
      } catch (error) {
        showAlert('✗ 加载分组出错: ' + error.message);
        groups.value = [];
      }
    };

    const loadRunningProfiles = async () => {
      try {
        const result = await window.api.getRunningProfiles();
        if (result.success) {
          runningProfiles.value = result.profiles || [];
        }
      } catch (error) {
        console.error('Failed to load running profiles:', error);
      }
    };

    const loadAll = async () => {
      await Promise.all([loadProfiles(), loadGroups(), loadRunningProfiles()]);
    };

    const saveProfileEdit = async (data) => {
      const { oldName, newName, updates } = data;
      
      try {
        if (oldName !== newName) {
          const result = await window.api.renameProfile(oldName, newName);
          if (result.error) {
            showAlert('✗ 重命名失败: ' + result.error);
            return;
          }
        }
        
        const result = await window.api.updateProfile(newName, updates);
        if (result.error) {
          showAlert('✗ 更新失败: ' + result.error);
        } else {
          showAlert('✓ 配置已更新');
          editingProfile.value = null;
          await loadAll();
        }
      } catch (error) {
        showAlert('✗ 更新失败: ' + error.message);
      }
    };

    const saveGroupEdit = async (data) => {
      const { id, updates } = data;
      
      try {
        const result = await window.api.updateGroup(id, updates);
        if (result.error) {
          showAlert('✗ 更新失败: ' + result.error);
        } else {
          showAlert('✓ 分组已更新');
          editingGroup.value = null;
          await loadAll();
        }
      } catch (error) {
        showAlert('✗ 更新失败: ' + error.message);
      }
    };

    const openProfile = async (name) => {
      const result = await window.api.openProfile(name);
      if (result.error) {
        showAlert('✗ 打开失败: ' + result.error);
      } else {
        showAlert('✓ 浏览器已启动');
        await loadRunningProfiles();
      }
    };

    const closeProfile = async (name) => {
      const result = await window.api.closeProfile(name);
      if (result.error) {
        showAlert('✗ 关闭失败: ' + result.error);
      } else {
        showAlert('✓ 浏览器已关闭');
        await loadRunningProfiles();
      }
    };

    onMounted(() => {
      loadAll();
      if (window.Iconify) {
        window.Iconify.render();
      }
      
      setInterval(loadRunningProfiles, 3000);
    });

    return {
      currentPage,
      profiles,
      groups,
      runningProfiles,
      alertMessage,
      alertClass,
      stats,
      editingProfile,
      editingGroup,
      navButtonClass,
      loadAll,
      saveProfileEdit,
      saveGroupEdit,
      openProfile,
      closeProfile
    };
  }
});

app.mount('#app');

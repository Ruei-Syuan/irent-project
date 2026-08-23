const stationRows = [
  ['基隆市', '安樂區', 'iRent基隆西定二站', '定國街14號'],
  ['基隆市', '仁愛區', 'iRent基隆車站南站', '港西街5號'],
  ['基隆市', '中正區', 'iRent基隆海洋廣場站', '忠一路港邊'],
  ['基隆市', '七堵區', 'iRent七堵車站停車場', '東新街2號'],
  ['基隆市', '信義區', 'iRent基隆市府站', '信二路301號'],
  ['臺北市', '中山區', 'iRent台北濱江門市', '松江路557號'],
  ['臺北市', '大同區', 'iRent台北承德二站停車場', '民權西路102巷4弄23號旁'],
  ['臺北市', '士林區', 'iRent士林中正機車停車場', '中正路404號'],
  ['臺北市', '中正區', 'iRent台北車站西區停車場', '北平西路3號西側'],
  ['臺北市', '信義區', 'iRent松山車站東區停車場', '中坡北路347號B1'],
  ['臺北市', '南港區', 'iRent南港車站停車場', '忠孝東路七段265巷1號'],
  ['臺北市', '松山區', 'iRent松山機場停車場', '敦化北路340之9號'],
  ['臺北市', '士林區', 'iRent台北士林門市', '承德路四段237號1樓'],
  ['臺北市', '中正區', 'iRent愛國西路停車場', '愛國西路42巷與廣州街口'],
  ['臺北市', '南港區', 'iRent台北忠孝門市', '忠孝東路六段135號'],
  ['臺北市', '內湖區', 'iRent內湖瑞光停車場', '瑞光路358巷30弄口'],
  ['臺北市', '大安區', 'iRent大安森林公園站', '信義路三段100號'],
  ['臺北市', '文山區', 'iRent捷運景美站', '羅斯福路六段393號'],
  ['臺北市', '北投區', 'iRent北投捷運站', '大業路700號'],
  ['臺北市', '萬華區', 'iRent龍山寺站', '西園路一段153號'],
  ['新北市', '淡水區', 'iRent淡水大忠街站', '大忠街66之6號旁'],
  ['新北市', '淡水區', 'iRent淡水中正停車場站', '中正路115號B1'],
  ['新北市', '中和區', 'iRent中和門市站', '連城路164之2號'],
  ['新北市', '新莊區', 'iRent新莊丹鳳停車場', '中正路726之4號'],
  ['新北市', '永和區', 'iRent永和門市站', '光復街4號'],
  ['新北市', '永和區', 'iRent國光路機車站', '中正路662巷43號對面'],
  ['新北市', '新莊區', 'iRent新莊門市站', '化成路2號'],
  ['新北市', '樹林區', 'iRent樹林門市', '保安街一段173號'],
  ['新北市', '林口區', 'iRent文化二路停車場', '文化二路二段88巷口'],
  ['新北市', '新店區', 'iRent台北新店門市', '北新路一段317號'],
  ['新北市', '三重區', 'iRent台北蘆洲門市', '集賢路111號1樓'],
  ['新北市', '板橋區', 'iRent板橋車站停車場', '縣民大道二段7號'],
  ['新北市', '汐止區', 'iRent汐止車站站', '信義路1號'],
  ['新北市', '土城區', 'iRent土城捷運站', '金城路一段105號'],
  ['新北市', '三峽區', 'iRent北大特區站', '學成路與大學路口'],
  ['桃園市', '中壢區', 'iRent中壢環北路停車場', '環北路406號'],
  ['桃園市', '中壢區', 'iRent中壢門市', '中華路二段66號'],
  ['桃園市', '中壢區', 'iRent國雲站前東停車場', '青山路站前東側'],
  ['桃園市', '平鎮區', 'iRent平鎮新榮路停車場', '新榮路315號旁'],
  ['桃園市', '桃園區', 'iRent桃園寶興停車場', '民有三街501號'],
  ['桃園市', '大園區', 'iRent桃園高鐵站', '高鐵北路一段6號'],
  ['桃園市', '龜山區', 'iRentA8長庚醫院站', '復興一路8號'],
  ['桃園市', '蘆竹區', 'iRent南崁站', '南崁路一段112號'],
  ['桃園市', '八德區', 'iRent八德廣豐站', '介壽路一段728號'],
  ['桃園市', '龍潭區', 'iRent龍潭中正站', '中正路106號'],
  ['新竹市', '東區', 'iRent新竹門市', '中華路二段66號'],
  ['新竹市', '東區', 'iRent新竹後火車站', '東南街1巷27號對面'],
  ['新竹市', '東區', 'iRent新竹高鐵站', '高鐵七路6號'],
  ['新竹市', '北區', 'iRent新竹市府站', '中正路120號'],
  ['新竹市', '香山區', 'iRent香山車站站', '中華路五段347巷2弄27號'],
  ['新竹縣', '竹北市', 'iRent竹北光明站', '光明六路10號'],
  ['新竹縣', '竹北市', 'iRent竹北遠百站', '莊敬北路18號'],
  ['新竹縣', '湖口鄉', 'iRent湖口車站站', '中山路二段121號'],
  ['臺中市', '東區', 'iRent台中自由路停車場', '自由路三段與進德路口'],
  ['臺中市', '西區', 'iRent柳川中華停車場', '大華街13號旁'],
  ['臺中市', '東區', 'iRent台中三井湖濱站', '進德路601號'],
  ['臺中市', '北屯區', 'iRent經貿一路停車場', '經貿一路70號對面'],
  ['臺中市', '北屯區', 'iRent捷運北屯總站', '敦富東街100號'],
  ['臺中市', '北屯區', 'iRent捷運松竹站', '北屯路458號'],
  ['臺中市', '西屯區', 'iRent逢甲河南停車場', '福上巷259號'],
  ['臺中市', '西屯區', 'iRent台中中港門市', '文心路三段46號'],
  ['臺中市', '東區', 'iRent台中火車站', '復興路四段251號'],
  ['臺中市', '烏日區', 'iRent台中高鐵站', '高鐵三路198號'],
  ['臺中市', '北屯區', 'iRent台中文心門市', '文心路四段770號'],
  ['臺中市', '南屯區', 'iRent文心森林公園站', '文心路一段289號'],
  ['彰化縣', '彰化市', 'iRent彰化中正路停車場', '中正路一段296號旁'],
  ['彰化縣', '彰化市', 'iRent華陽市場停車場', '旭光路105號對面'],
  ['彰化縣', '員林市', 'iRent員林車站站', '民權街55號'],
  ['彰化縣', '鹿港鎮', 'iRent鹿港鎮公所站', '民權路168號'],
  ['彰化縣', '田中鎮', 'iRent高鐵彰化站', '站區路二段99號'],
  ['嘉義市', '西區', 'iRent嘉義火車站', '中山路528號'],
  ['嘉義市', '東區', 'iRent嘉義文化公園站', '民族路與文化路口'],
  ['嘉義市', '西區', 'iRent嘉義轉運中心站', '中興路1號'],
  ['嘉義縣', '太保市', 'iRent高鐵嘉義站', '高鐵西路168號'],
  ['嘉義縣', '民雄鄉', 'iRent民雄車站站', '和平路2號'],
  ['臺南市', '中西區', 'iRent台南火車站', '中山路188號'],
  ['臺南市', '永康區', 'iRent台南中正門市站', '中正南路380號'],
  ['臺南市', '東區', 'iRent台南中華門市站', '中華東路三段228號'],
  ['臺南市', '北區', 'iRent台南成功站停車場', '成功路22巷3號'],
  ['臺南市', '永康區', 'iRent台南大橋後站停車場', '中華路912巷旁'],
  ['臺南市', '永康區', 'iRent永康中華第二停車場', '中華路575號旁'],
  ['臺南市', '中西區', 'iRent台南康樂街站', '康樂街與民生路口'],
  ['臺南市', '永康區', 'iRent永康新行街站', '新行街4巷5號對面'],
  ['臺南市', '永康區', 'iRent永康中華路停車場', '中華路143號'],
  ['臺南市', '歸仁區', 'iRent高鐵台南站', '歸仁大道100號'],
  ['高雄市', '左營區', 'iRent左營門市', '高鐵路358號'],
  ['高雄市', '新興區', 'iRent高雄中正門市站', '中正三路28號'],
  ['高雄市', '三民區', 'iRent三鳳自立停車場', '三德西街23號對面'],
  ['高雄市', '左營區', 'iRent高鐵左營站', '重信路623之2號'],
  ['高雄市', '苓雅區', 'iRent文化中心站', '五福一路67號'],
  ['高雄市', '前鎮區', 'iRent夢時代站', '中華五路789號'],
  ['高雄市', '鼓山區', 'iRent高雄美術館站', '美術館路80號'],
  ['高雄市', '楠梓區', 'iRent楠梓車站站', '建楠路229號'],
  ['高雄市', '鳳山區', 'iRent鳳山車站站', '曹公路68號'],
  ['高雄市', '小港區', 'iRent高雄機場站', '中山四路2號'],
  ['宜蘭縣', '宜蘭市', 'iRent宜蘭車站站', '光復路1號'],
  ['宜蘭縣', '羅東鎮', 'iRent羅東車站站', '公正路2號'],
  ['花蓮縣', '花蓮市', 'iRent花蓮車站站', '國聯一路100號'],
  ['花蓮縣', '吉安鄉', 'iRent吉安車站站', '南昌街200號'],
  ['臺東縣', '臺東市', 'iRent台東車站站', '岩灣路101巷598號']
];

const stationCoordinates = new Map([
  ['ST001', [25.1209755, 121.7233243]],
  ['ST004', [25.0977723, 121.7163953]],
  ['ST007', [25.0659860, 121.5155140]],
  ['ST010', [25.0333448, 121.5668963]],
  ['ST013', [25.0918396, 121.5242068]],
  ['ST016', [25.0696640, 121.5889983]],
  ['ST019', [25.1324190, 121.5013790]],
  ['ST022', [25.1813044, 121.4531477]],
  ['ST025', [25.0092350, 121.5200703]],
  ['ST028', [24.9907063, 121.4205326]],
  ['ST031', [25.0614860, 121.4881020]],
  ['ST034', [24.9722010, 121.4433480]],
  ['ST037', [24.9653531, 121.2249260]],
  ['ST040', [24.9939230, 121.3016800]],
  ['ST043', [25.0506448, 121.2917322]],
  ['ST046', [24.8047326, 120.9736257]],
  ['ST049', [24.8187543, 120.9600440]],
  ['ST052', [24.8396820, 121.0040779]],
  ['ST055', [24.1413800, 120.6710400]],
  ['ST058', [24.1822644, 120.6862883]],
  ['ST061', [24.1653026, 120.6336550]],
  ['ST064', [24.1822644, 120.6862883]],
  ['ST067', [24.0807667, 120.5423000]],
  ['ST070', [23.8612667, 120.5809667]],
  ['ST073', [23.4642846, 120.4348533]],
  ['ST076', [22.9921516, 120.2059575]],
  ['ST079', [23.0138559, 120.1999226]],
  ['ST082', [22.9921516, 120.2059575]],
  ['ST085', [22.9671694, 120.2938390]],
  ['ST088', [22.6476949, 120.2996219]]
]);

export const stationSeeds = stationRows.map((row, index) => {
  const code = `ST${String(index + 1).padStart(3, '0')}`;
  const [latitude, longitude] = stationCoordinates.get(code) ?? [null, null];
  return {
    code,
    city: row[0],
    district: row[1],
    name: row[2],
    address: `${row[0]}${row[1]}${row[3]}`,
    latitude,
    longitude,
    stationType: row[2].includes('停車場') ? 'parking' : 'station'
  };
});

const plates = [
  'RAC-4582', 'RBC-2108', 'RBA-6935', 'RAD-7731', 'RAF-8910', 'RBG-1357',
  'RAH-2468', 'RBJ-3021', 'RCK-5874', 'RDL-6149', 'REM-7203', 'RFN-8456',
  'RGP-9312', 'RHQ-1647', 'RJR-2580', 'RKS-3491', 'RLT-4376', 'RMU-5268',
  'RNV-6184', 'RPW-7095', 'RQX-8320', 'RRY-9451', 'RSZ-1037', 'RTA-2148',
  'RUB-3259', 'RVC-4360', 'RWD-5471', 'RXE-6582', 'RYF-7693', 'RZG-8704'
];

const models = ['Toyota Yaris', 'Toyota Vios', 'Honda Fit', 'Toyota Corolla Cross', 'Nissan Kicks', 'LUXGEN U5', 'Mitsubishi Colt Plus'];
const colors = ['白', '銀', '藍', '灰', '紅', '黑', '橘'];

const customerNames = [
  '王小明', '陳怡君', '林志豪', '張雅婷', '李冠廷', '黃筱雯',
  '吳俊傑', '劉品妤', '蔡承恩', '楊佳穎', '許家維', '鄭詩涵',
  '謝孟哲', '洪郁婷', '郭柏宇', '邱思妤', '曾建宏', '廖婉婷',
  '賴彥廷', '徐鈺涵', '周子翔', '葉欣儀', '蘇祐辰', '莊佩珊',
  '呂宗翰', '江宛庭', '何宇軒', '蕭佳琪', '羅文凱', '高語彤'
];

export const customerSeeds = customerNames.map((fullName, index) => ({
  memberNo: `MEM${String(index + 1).padStart(4, '0')}`,
  fullName,
  phone: `09${String(12000000 + index * 17391).slice(-8)}`
}));

export const vehicleSeeds = plates.map((licensePlate, index) => {
  const isMaintenance = [0, 3, 11, 18, 25].includes(index);
  const isCleaning = [1, 8, 14, 22, 28].includes(index);
  return {
    licensePlate,
    model: models[index % models.length],
    color: colors[index % colors.length],
    stationCode: `ST${String((index * 3) % 100 + 1).padStart(3, '0')}`,
    status: isMaintenance ? 'maintenance' : isCleaning ? 'cleaning' : 'available',
    cabinCondition: isCleaning ? 'dirty' : index % 3 === 0 ? 'average' : 'clean',
    healthScore: isMaintenance ? 62 + index % 8 : isCleaning ? 76 + index % 8 : 88 + index % 12,
    todayMileage: Number((18.4 + index * 2.7).toFixed(1)),
    latestAnomaly: isMaintenance ? ['右後保桿刮傷', '右前輪胎壓異常', '左後視鏡損傷'][index % 3] : isCleaning ? '車內髒污待清潔' : null
  };
});

export const anomalySeeds = [
  { licensePlate: 'RAC-4582', anomalyType: '右後保桿新刮傷', confidence: 96, status: 'pending', detectedAt: '2026-08-17 09:58:00' },
  { licensePlate: 'RBC-2108', anomalyType: '車內液體髒污', confidence: 92, status: 'review', detectedAt: '2026-08-17 09:47:00' },
  { licensePlate: 'RAD-7731', anomalyType: '右前輪胎壓異常', confidence: 89, status: 'pending', detectedAt: '2026-08-17 09:32:00' },
  { licensePlate: 'RAF-8910', anomalyType: '左後視鏡損傷', confidence: 90, status: 'review', detectedAt: '2026-08-17 09:15:00' },
  { licensePlate: 'RBG-1357', anomalyType: '後保桿擦傷', confidence: 85, status: 'review', detectedAt: '2026-08-17 08:59:00' }
];

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

function taipeiDayStart(date, dayOffset) {
  const taipeiNow = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return new Date(Date.UTC(
    taipeiNow.getUTCFullYear(),
    taipeiNow.getUTCMonth(),
    taipeiNow.getUTCDate() + dayOffset
  ) - TAIPEI_OFFSET_MS);
}

export function createRentalSeeds(today = new Date()) {
  const dailyCounts = [7, 9, 8, 11, 10, 12, 9];
  const rentals = [];

  dailyCounts.forEach((count, dayIndex) => {
    const dayStart = taipeiDayStart(today, dayIndex - 6);
    for (let vehicleIndex = 0; vehicleIndex < count; vehicleIndex += 1) {
      const startedAt = new Date(dayStart.getTime() + (9 + vehicleIndex % 5) * 60 * 60 * 1000);
      const endedAt = new Date(startedAt.getTime() + (2 + vehicleIndex % 3) * 60 * 60 * 1000);
      rentals.push({
        licensePlate: plates[(vehicleIndex + dayIndex * 3) % plates.length],
        customerMemberNo: customerSeeds[(vehicleIndex + dayIndex) % customerSeeds.length].memberNo,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        status: dayIndex === 6 ? 'active' : 'completed',
        rentalFee: 720 + (2 + vehicleIndex % 3) * 180
      });
    }
  });

  const multiDayStart = new Date(taipeiDayStart(today, -4).getTime() + 15 * 60 * 60 * 1000);
  rentals.push({
    licensePlate: plates.at(-1),
    customerMemberNo: customerSeeds.at(-1).memberNo,
    startedAt: multiDayStart.toISOString(),
    endedAt: new Date(taipeiDayStart(today, 1).getTime() + 60 * 60 * 1000).toISOString(),
    status: 'active',
    rentalFee: 2880
  });

  return rentals;
}

export function createServiceSeeds() {
  return plates.flatMap((licensePlate, index) => [
    {
      licensePlate,
      type: 'cleaning',
      performedAt: new Date(Date.UTC(2026, 7, 2 + index % 16, 2, 0)).toISOString(),
      cost: 450 + index % 4 * 80,
      note: index % 2 ? '車內基礎清潔' : '內裝深度清潔'
    },
    {
      licensePlate,
      type: 'maintenance',
      performedAt: new Date(Date.UTC(2026, 6, 3 + index % 20, 3, 0)).toISOString(),
      cost: 1800 + index % 6 * 650,
      note: index % 3 ? '定期保養與安全檢查' : '更換耗材與煞車檢查'
    }
  ]);
}

export function createRepairOrderSeeds() {
  return [
    ['信義速修中心', 'RO-260809-042', 'RAC-4582', '右後保桿鈑噴', '維修中', 4200],
    ['板橋輪胎站', 'RO-260809-039', 'RAD-7731', '右前輪檢測', '維修中', 1800],
    ['中山保修廠', 'RO-260809-036', 'RCK-5874', '右後燈更換', '維修中', 6500],
    ['士林速修中心', 'RO-260809-031', 'RDL-6149', '左前燈修復', '待驗收', 3600]
  ].map(([repairCenter, orderNumber, licensePlate, maintenanceItem, status, estimatedCost]) => ({
    repairCenter,
    orderNumber,
    licensePlate,
    maintenanceItem,
    status,
    estimatedCost,
    actualCost: null,
    completedAt: null
  }));
}

export function createAdditionalRepairOrderSeeds() {
  return [
    ['南港維修中心', 'RO-260823-001', 'RBC-2108', '定期保養與換油', '維修完畢', 2800, 2650, '2026-08-20T09:00:00.000Z', 'ops101@irent.example.tw'],
    ['松山汽車工坊', 'RO-260823-002', 'RBA-6935', '煞車系統檢修', '維修中', 5200, null, null, 'dsp208@irent.example.tw'],
    ['內湖保修廠', 'RO-260823-003', 'RAF-8910', '冷氣濾網更換', '待驗收', 1600, null, null, 'flt315@irent.example.tw'],
    ['大直維修中心', 'RO-260823-004', 'RBG-1357', '左側車門鈑金', '維修完畢', 7800, 7600, '2026-08-18T08:30:00.000Z', 'dmg422@irent.example.tw'],
    ['士林速修中心', 'RO-260823-005', 'RAH-2468', '輪胎更換', '維修完畢', 4400, 4400, '2026-08-19T11:20:00.000Z', 'mnt536@irent.example.tw'],
    ['北投汽車工坊', 'RO-260823-006', 'RBJ-3021', '電瓶更換', '維修中', 3100, null, null, 'rpt607@irent.example.tw'],
    ['信義速修中心', 'RO-260823-007', 'REM-7203', '引擎異音檢查', '待驗收', 2300, null, null, 'csv718@irent.example.tw'],
    ['板橋輪胎站', 'RO-260823-008', 'RFN-8456', '四輪定位', '維修完畢', 1200, 1200, '2026-08-17T14:00:00.000Z', 'aud829@irent.example.tw'],
    ['中山保修廠', 'RO-260823-009', 'RGP-9312', '雨刷馬達更換', '維修完畢', 3600, 3450, '2026-08-16T10:10:00.000Z', 'ops101@irent.example.tw'],
    ['南港維修中心', 'RO-260823-010', 'RHQ-1647', '前保桿固定座修復', '維修中', 2700, null, null, 'dsp208@irent.example.tw'],
    ['松山汽車工坊', 'RO-260823-011', 'RJR-2580', '車內清潔與消毒', '維修完畢', 900, 900, '2026-08-15T16:40:00.000Z', 'flt315@irent.example.tw'],
    ['內湖保修廠', 'RO-260823-012', 'RKS-3491', '輪胎胎壓感測器', '維修中', 2900, null, null, 'dmg422@irent.example.tw'],
    ['大直維修中心', 'RO-260823-013', 'RLT-4376', '後視鏡更換', '待驗收', 4100, null, null, 'mnt536@irent.example.tw'],
    ['北投汽車工坊', 'RO-260823-014', 'RMU-5268', '底盤異音檢修', '維修完畢', 5800, 5600, '2026-08-14T13:15:00.000Z', 'rpt607@irent.example.tw'],
    ['信義速修中心', 'RO-260823-015', 'RNV-6184', '煞車來令片更換', '維修中', 3900, null, null, 'csv718@irent.example.tw']
  ].map(([repairCenter, orderNumber, licensePlate, maintenanceItem, status, estimatedCost, actualCost, completedAt, managerEmail]) => ({
    repairCenter, orderNumber, licensePlate, maintenanceItem, status, estimatedCost, actualCost, completedAt, managerEmail
  }));
}

export function createLastMonthRepairOrderSeeds() {
  return [
    ['中山保修廠', 'RO-260731-001', 'RWD-5471', '引擎機油與濾芯更換', '維修完畢', 2600, 2480, '2026-07-28T09:30:00.000Z', 'ops101@irent.example.tw'],
    ['南港維修中心', 'RO-260731-002', 'RXE-6582', '前輪軸承更換', '維修完畢', 6300, 6150, '2026-07-25T13:10:00.000Z', 'dsp208@irent.example.tw'],
    ['板橋輪胎站', 'RO-260731-003', 'RYF-7693', '四輪輪胎更換', '維修完畢', 9800, 9600, '2026-07-22T15:40:00.000Z', 'flt315@irent.example.tw'],
    ['信義速修中心', 'RO-260731-004', 'RZG-8704', '冷卻系統檢修', '維修完畢', 4700, 4550, '2026-07-18T10:20:00.000Z', 'mnt536@irent.example.tw'],
    ['松山汽車工坊', 'RO-260731-005', 'RTA-2148', '車門鎖及中控檢修', '維修完畢', 3500, 3380, '2026-07-12T11:00:00.000Z', 'rpt607@irent.example.tw']
  ].map(([repairCenter, orderNumber, licensePlate, maintenanceItem, status, estimatedCost, actualCost, completedAt, managerEmail]) => ({
    repairCenter, orderNumber, licensePlate, maintenanceItem, status, estimatedCost, actualCost, completedAt, managerEmail
  }));
}

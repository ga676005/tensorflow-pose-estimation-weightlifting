先錄影
手動回放標至少三個 checkpoints 組成一個 detection
儲存紀錄，預設檔案名
如果有遠端，看是要存本裝置還是全存
可能要有個地方選擇要使用哪些 detection
不然數量多全部跑的話又60fps不知道會不會有效能問題

checkpoint 的 keypoints 方向最好是連續的，例如 1 到 2 是往上，2 到 3 也要往上
1 2 3
先檢查 1 再檢查 2 再檢查 3
如果在 2 要檢查 3 卻檢查到 1 那就重置

checkpoints 不一定是完成一個循環，如果是深蹲、臥推可能是抓最低點
如果抓到 2，記錄當下時間 - 0.5 秒，rangeStartTimestamp
如果順利抓到最後一個 checkpoint，把 rangeStartTimestamp 存到 array，等錄影完後要處理
只標起始點，不標終點

每個 checkpoint 會有 keypoints，只要記 0.7 以上的 keypoints
耳朵鼻子應該不用
keypoints 的判斷先抓 x y 1% 誤差
錄影的時候比較 keypoints

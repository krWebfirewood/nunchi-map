interface GettingStartedProps {
  hasGroup: boolean;
  hasSchedule: boolean;
  onGroupSetup: () => void;
  onScheduleSetup: () => void;
}

export function GettingStarted({ hasGroup, hasSchedule, onGroupSetup, onScheduleSetup }: GettingStartedProps) {
  return (
    <section className="getting-started" aria-labelledby="getting-started-title">
      <div className="getting-started-copy">
        <p className="eyebrow">QUICK START</p>
        <h2 id="getting-started-title">처음이라면,<br />이 순서로 시작해요.</h2>
        <p>개인 일정은 그대로 두고 같은 비공개 그룹 안에서만 겹침 가능성을 확인합니다.</p>
      </div>
      <ol className="getting-started-steps">
        <li className={hasGroup ? "complete" : "current"}>
          <span className="step-number">{hasGroup ? "✓" : "1"}</span>
          <div><small>STEP 1</small><strong>그룹 연결</strong><p>그룹을 만들거나 받은 초대 코드로 참여하세요.</p></div>
          <button type="button" onClick={onGroupSetup}>{hasGroup ? "완료" : "그룹 설정"}</button>
        </li>
        <li className={hasSchedule ? "complete" : hasGroup ? "current" : "locked"}>
          <span className="step-number">{hasSchedule ? "✓" : "2"}</span>
          <div><small>STEP 2</small><strong>첫 일정 등록</strong><p>날짜·시간·장소와 공유 범위를 정해 주세요.</p></div>
          <button type="button" onClick={onScheduleSetup}>{hasSchedule ? "완료" : "일정 등록"}</button>
        </li>
        <li className={hasGroup && hasSchedule ? "current" : "locked"}>
          <span className="step-number">3</span>
          <div><small>STEP 3</small><strong>지도에서 확인</strong><p>달력 날짜를 누르고 시간 슬라이더로 겹침 영역을 살펴보세요.</p></div>
          <span className="step-ready">{hasGroup && hasSchedule ? "준비됨" : "다음 단계"}</span>
        </li>
      </ol>
      <div className="getting-started-legend"><span><i className="safe" />초록: 충돌 없음</span><span><i className="medium" />주황: 주의</span><span><i className="high" />빨강: 가능성 높음</span><span><i className="private" />회색: 나만 보기</span></div>
    </section>
  );
}

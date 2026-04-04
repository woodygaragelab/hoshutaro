import os
import logging
from typing import Dict, List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class SkillDefinition(BaseModel):
    name: str
    description: str
    triggers: List[str]
    context: str

class SkillLoader:
    def __init__(self, filepath: str = "skills/SKILLS.md"):
        self.filepath = filepath
        self.skills: Dict[str, SkillDefinition] = {}
        self.reload()

    def reload(self):
        """SKILLS.mdを再読み込みし、パースする"""
        if not os.path.exists(self.filepath):
            logger.warning(f"Skill file not found: {self.filepath}")
            return
            
        with open(self.filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        self.skills = self._parse_markdown(content)
        logger.info(f"Loaded {len(self.skills)} skills from {self.filepath}")

    def _parse_markdown(self, text: str) -> Dict[str, SkillDefinition]:
        """
        簡易的なMarkdownパーサー
        ## skill: <name>
        description: <desc>
        trigger: ["A", "B"]
        context: |
          <context text>
        """
        skills = {}
        current_name = None
        current_desc = ""
        current_triggers = []
        current_context = []
        in_context = False
        
        lines = text.split("\n")
        
        def save_current():
            if current_name:
                skills[current_name] = SkillDefinition(
                    name=current_name,
                    description=current_desc,
                    triggers=current_triggers,
                    context="\n".join(current_context).strip()
                )
                
        for line in lines:
            if line.startswith("## skill:"):
                save_current()
                current_name = line.replace("## skill:", "").strip()
                current_desc = ""
                current_triggers = []
                current_context = []
                in_context = False
                continue
                
            if current_name is None:
                continue
                
            if line.startswith("description:"):
                current_desc = line.replace("description:", "").strip()
                in_context = False
            elif line.startswith("trigger:"):
                trig_str = line.replace("trigger:", "").strip()
                # 簡易に[ ]や" "を削除してリスト化
                trig_str = trig_str.replace("[", "").replace("]", "").replace('"', "")
                current_triggers = [t.strip() for t in trig_str.split(",") if t.strip()]
                in_context = False
            elif line.startswith("context: |"):
                in_context = True
            elif in_context:
                # 雑に後続をcontextとみなす
                if line.startswith("## skill:"):
                    in_context = False
                    # これは上でフックされるため本来は入らない
                else:
                    current_context.append(line)
                    
        save_current()
        return skills

    def get_skill(self, name: str) -> Optional[SkillDefinition]:
        return self.skills.get(name)

    def match_skill(self, instruction: str) -> Optional[SkillDefinition]:
        """ユーザー指示からトリガー単語が一番多く含まれるスキルを返す"""
        best_skill = None
        best_score = 0
        for name, skill in self.skills.items():
            score = sum(1 for t in skill.triggers if t in instruction)
            if score > best_score:
                best_score = score
                best_skill = skill
        return best_skill
        
# シングルトンインスタンス
skill_loader = SkillLoader()

import logging
import os
import json

from app.services.skill_loader import skill_loader
from app.services.llm_shim import get_llm_adapter

logger = logging.getLogger(__name__)

async def optimize_skill(skill_name: str, failed_instructions: list[str], current_context: str) -> str:
    """
    失敗した指示のリストと現在のコンテキストをメタLLMに渡し、新しいコンテキスト(プロンプト)を生成させる。
    """
    adapter = get_llm_adapter()
    if not adapter:
        return current_context
        
    system_prompt = (
        "あなたはAIエージェントのプロンプト・エンジニアです。"
        f"スキル '{skill_name}' において、以下のユーザー指示に対してエージェントが適切にふるまえず失敗しました。\n"
        f"【失敗した指示例】\n{failed_instructions}\n\n"
        "現在のプロンプトコンテキストは以下です:\n"
        f"```\n{current_context}\n```\n\n"
        "これらのエラーを防ぎ、より堅牢に動作するようコンテキストの文章を修正・追加して、"
        "新しいコンテキストの本文のみ（マークダウンのコードブロック等は不要）を出力してください。"
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "コンテキストを改善して出力してください。"}
    ]
    
    try:
        new_context = await adapter.chat(messages)
        if new_context and len(new_context.strip()) > 10:
            return new_context.strip()
    except Exception as e:
        logger.error(f"Failed to optimize skill {skill_name}: {e}")
        
    return current_context

def update_skills_file(skill_name: str, new_context: str, filepath: str = "skills/SKILLS.md"):
    """
    SKILLS.md の特定のスキルのcontext部分を新しいテキストで置換して保存する
    """
    if not os.path.exists(filepath):
        return
        

        
    # 簡易置換：該当スキルの ## skill: <name> から次の ## skill: までの間をパースして再構築するのは複雑なため、
    # loaderの全スキル情報を元にファイルを再構築する。
    skills = skill_loader.skills
    if skill_name in skills:
        skills[skill_name].context = new_context
        
        # 再構築
        lines = []
        for name, skill in skills.items():
            lines.append(f"## skill: {name}")
            lines.append(f"description: {skill.description}")
            lines.append(f"trigger: {json.dumps(skill.triggers, ensure_ascii=False)}")
            lines.append("context: |")
            for cl in skill.context.split("\n"):
                lines.append(f"  {cl}")
            lines.append("\n")
            
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
            
            logger.info(f"Updated SKILLS.md for skill: {skill_name}")
        skill_loader.reload()

